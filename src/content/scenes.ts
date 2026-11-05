import type { CalcStep } from '../engine'
import { childAllowanceTotal, computeResidentTax, analyzeStudentJob, man } from '../engine'
import type { GameState } from '../game/types'
import { rulesFor, yearOf } from '../game/state'
import {
  chooseHighSchoolJob,
  chooseOtoshidama,
  choosePath,
  enterBirth,
  HIGH_SCHOOL_JOB_OPTIONS,
  jobStartAge,
} from '../game/actions'

export type SceneKind =
  | 'story'
  | 'walls'
  | 'company'
  | 'payslip'
  | 'firstYearChoices'
  | 'yearEnd'
  | 'finalReturn'
  | 'summary'
  | 'end'

export interface Choice {
  label: string
  detail?: string
  act: (s: GameState) => GameState
}

export interface WhyBlock {
  title: string
  steps: CalcStep[]
}

export interface Scene {
  id: string
  kind: SceneKind
  stage: string
  title: (s: GameState) => string
  lines: (s: GameState) => string[]
  facts?: (s: GameState) => { label: string; value: string; who?: string }[]
  explain?: string
  why?: (s: GameState) => WhyBlock[]
  choices?: (s: GameState) => Choice[]
  onEnter?: (s: GameState) => GameState
}

const go = (sceneId: string) => (s: GameState): GameState => ({ ...s, sceneId })

export const STAGES = ['誕生', '子ども時代', '高校生', '進路', '大学生', '就職', '年末調整', 'まとめ']

export const SCENES: Record<string, Scene> = {
  birth: {
    id: 'birth',
    kind: 'story',
    stage: '誕生',
    title: (s) => `${yearOf(s, 0)}年 あなたはここに生まれました`,
    onEnter: enterBirth,
    lines: (s) => [
      `おぎゃー!${s.name}さん、誕生おめでとさん!ワイは貯金箱の妖精、ゼイ吉や。`,
      'これから一生ぶんのお金の流れを、いっしょに見ていくで。税金って聞くと眠くなる?大丈夫、ワイのダジャレで目ぇ覚まさせたる。……今のはまだダジャレちゃうで。',
      'さっそくやけど、生まれた瞬間から「お金のイベント」は起きとる。親の健康保険から出産育児一時金、国から児童手当や。',
    ],
    facts: (s) => {
      const r = rulesFor(s, 0)
      return [
        { label: '出産育児一時金', value: man(r.benefits.birthLumpSum), who: '親が受け取る' },
        { label: '児童手当(0〜2歳)', value: `月${r.benefits.childAllowanceMonthly.under3.toLocaleString()}円`, who: '親が受け取る' },
        { label: '児童手当 18歳までの合計', value: man(childAllowanceTotal(1, r)), who: '親が受け取る' },
      ]
    },
    explain: 'birth',
    choices: () => [{ label: 'すくすく育つ(6歳へ)', act: go('otoshidama') }],
  },
  otoshidama: {
    id: 'otoshidama',
    kind: 'story',
    stage: '子ども時代',
    title: (s) => `${yearOf(s, 6)}年 6歳 はじめてのお年玉`,
    lines: () => [
      '小学生になったで!お正月におじいちゃんおばあちゃんからお年玉や。これから中学卒業まで、毎年3万円くらいもらえそうやな。',
      'ところで、もらったお金には「贈与税」っちゅう税金があるの、知っとった?……でもお年玉で心配はいらん。くわしくは「やさしい解説」を見てな。',
      'さて、10年分のお年玉(合計30万円)、どうする?',
    ],
    explain: 'otoshidama',
    choices: () => [
      { label: '全部貯金する', detail: '30万円を貯金', act: (s) => go('highschool')(chooseOtoshidama(s, 'all')) },
      { label: '半分貯金、半分使う', detail: '15万円を貯金', act: (s) => go('highschool')(chooseOtoshidama(s, 'half')) },
      { label: '全部使う!', detail: 'ゲームにマンガに……', act: (s) => go('highschool')(chooseOtoshidama(s, 'none')) },
    ],
  },
  highschool: {
    id: 'highschool',
    kind: 'story',
    stage: '高校生',
    title: (s) => `${yearOf(s, 16)}年 16歳 アルバイトを始める?`,
    lines: (s) => {
      const out = [
        '高校生になったな。アルバイトしてみるか?',
        '16歳からは、親が「扶養控除」を受けられるようになる。あんたを養ってることで親の税金が安くなるしくみや。',
        'ただし、あんたの年収が136万円を超えると、親は扶養控除を受けられへん。そうなると親の税金が増えるんや。',
      ]
      if (s.flags.lottery) out.unshift('そういや子どものころ宝くじで1万円当たっとったな。あれも税金はかからへんで。')
      return out
    },
    explain: 'highschool',
    why: (s) => {
      const r = rulesFor(s, 16)
      return HIGH_SCHOOL_JOB_OPTIONS.filter((x) => x > 0).map((x) => {
        const a = analyzeStudentJob(x, 16, s.parentSalary, r)
        return {
          title: `年収${man(x)}の場合`,
          steps: [
            { label: '自分の所得税', value: a.ownIncomeTax },
            { label: '自分の住民税(翌年)', value: a.ownResidentTaxNextYear, note: '18歳未満は所得135万円以下なら非課税' },
            { label: '親の税金の増加', value: a.parentTaxIncrease },
          ],
        }
      })
    },
    choices: () =>
      HIGH_SCHOOL_JOB_OPTIONS.map((x) => ({
        label: x === 0 ? 'バイトはしない(勉強と部活)' : `年${man(x)}くらい働く`,
        detail:
          x === 0 ? '' : x <= 400_000 ? '週2日くらい' : x <= 900_000 ? '週4日くらい' : 'かなりがっつり',
        act: (s: GameState) => go('path')(chooseHighSchoolJob(s, x)),
      })),
  },
  path: {
    id: 'path',
    kind: 'story',
    stage: '進路',
    title: (s) => `${yearOf(s, 18)}年 18歳 進路を決める`,
    lines: (s) => [
      `高校卒業や!今の貯金は${man(s.savings)}。`,
      '大学に行くか、働くか。大学なら学費の足しに奨学金を借りる手もある。ただし貸与型は「借金」やから、社会人になってから返していくんやで。',
    ],
    explain: 'scholarship',
    choices: () => [
      { label: '大学に進学する', detail: '学費は親が出してくれる', act: (s) => go('university')(choosePath(s, 'university')) },
      {
        label: '大学に進学+奨学金を借りる',
        detail: '月5万円 × 4年 = 240万円を借りる',
        act: (s) => go('university')(choosePath(s, 'universityLoan')),
      },
      { label: '高校を出て就職する', detail: '18歳で社会人デビュー', act: (s) => go('company')(choosePath(s, 'work')) },
    ],
  },
  university: {
    id: 'university',
    kind: 'walls',
    stage: '大学生',
    title: (s) => `${yearOf(s, 19)}年 大学生 バイト年収と「壁」`,
    lines: () => [
      '大学生や!バイトのシフトをどれくらい入れるか決めよか。',
      '「103万円の壁」って聞いたことあるやろ?実はそれ、もう昔の話や。令和8年分のルールやと、壁の位置はこうなっとる。',
      'あんた自身と、親の財布。両方あわせた「家族全体の手取り」で考えるのがコツやで。',
    ],
    explain: 'walls',
  },
  company: {
    id: 'company',
    kind: 'company',
    stage: '就職',
    title: (s) => `${yearOf(s, jobStartAge(s))}年 ${jobStartAge(s)}歳 就職先を選ぶ`,
    lines: (s) => [
      s.flags.path === 'work' ? '18歳で社会人デビューや!' : '大学卒業おめでとう!いよいよ社会人や。',
      '内定は2社。月給だけやなくて、ボーナスも見て比べるんやで。',
    ],
    explain: 'payslip',
  },
  payslip: {
    id: 'payslip',
    kind: 'payslip',
    stage: '就職',
    title: () => '4月 はじめての給与明細',
    lines: (s) => [
      `初任給や!月給は${man(s.job?.company.monthly ?? 0)}……って、振り込まれた額、少なない!?`,
      'それが「額面」と「手取り」の差や。明細の1行ずつ、何が引かれとるか見てみよか。',
    ],
    explain: 'payslip',
  },
  firstYearChoices: {
    id: 'firstYearChoices',
    kind: 'firstYearChoices',
    stage: '就職',
    title: () => '5月 社会人の「そなえ」を考える',
    lines: () => [
      '新生活が始まったら、保険のおばちゃん……やなくて保険の営業さんが来たり、先輩からiDeCoをすすめられたりするもんや。',
      '払ったお金によっては税金が安くなるで。ただし、年末調整で自分から申告せんとアカン。覚えときや。',
    ],
    explain: 'firstYearChoices',
  },
  june: {
    id: 'june',
    kind: 'story',
    stage: '就職',
    title: () => '6月 住民税の通知が来た',
    lines: (s) => {
      const levy = s.residentLevies[yearOf(s, (s.job?.age ?? 22) - 1)] ?? 0
      const out =
        levy > 0
          ? [
              `6月の給与明細から、住民税が月${Math.floor(levy / 12).toLocaleString()}円引かれ始めたで。`,
              `これは去年のバイト代に対する住民税(年${levy.toLocaleString()}円)や。住民税は「1年おくれ」でやってくるんや。`,
            ]
          : [
              '6月や。去年の所得が少なかったから、住民税はゼロや。ラッキー!',
              'でも油断したらアカン。今年の給料に対する住民税は、来年の6月から引かれ始める。2年目は手取りが減る年なんや。',
            ]
      if (s.flags.injured) {
        out.push(
          `……って、あんた階段で足の骨を折ったんか!?通院とリハビリで、今年の医療費は合計${man(s.flags.medicalExpenses ?? 0)}になりそうや。領収書は捨てたらアカンで!`,
        )
      } else {
        out.push(`ついでに歯医者に行ったんやな。今年の医療費は${man(s.flags.medicalExpenses ?? 0)}。領収書はとっとこな。`)
      }
      return out
    },
    explain: 'resident',
    why: (s) => {
      const age = (s.job?.age ?? 22) - 1
      const rec = s.records.find((r) => r.age === age)
      if (!rec) return []
      const r = computeResidentTax(
        {
          salaryGross: rec.gross,
          socialInsurance: rec.socialInsurance,
          workingStudent: age <= 22,
          minor: age < 18,
        },
        rulesFor(s, age),
      )
      return [{ title: `${age}歳のときの収入${man(rec.gross)}に対する住民税`, steps: r.steps }]
    },
    choices: () => [{ label: '12月へ進む', act: go('yearEnd') }],
  },
  yearEnd: {
    id: 'yearEnd',
    kind: 'yearEnd',
    stage: '年末調整',
    title: () => '12月 はじめての年末調整',
    lines: () => [
      '来たで、12月!会社の総務部から「年末調整の書類を出してください」ってメールや。',
      '机の上の書類から、年末調整に出すものを選んで、申告書に入力するんや。出し忘れたら、戻ってくるはずのお金が戻ってこんで!',
    ],
    explain: 'yearEnd',
  },
  finalReturn: {
    id: 'finalReturn',
    kind: 'finalReturn',
    stage: '年末調整',
    title: (s) => `${yearOf(s, (s.job?.age ?? 22) + 1)}年2月 確定申告`,
    lines: (s) =>
      s.yearEnd?.submitted
        ? ['年末調整では使えへん控除や、出し忘れた控除は、確定申告で取り返せるで。', 'e-Tax風の画面で申告してみよか。']
        : [
            '年末調整を出さへんかったんか……。でも安心し。確定申告すれば、ちゃんと取り返せるんや。',
            'e-Tax風の画面で申告してみよか。',
          ],
    explain: 'finalReturn',
  },
  summary: {
    id: 'summary',
    kind: 'summary',
    stage: 'まとめ',
    title: () => '社会人1年目のまとめ',
    lines: () => ['1年おつかれさん!あんたのお金の流れを図にしてみたで。'],
    explain: 'resident',
  },
  end: {
    id: 'end',
    kind: 'end',
    stage: 'まとめ',
    title: () => '第1部 完',
    lines: (s) => [
      `${s.name}さん、ここまでおつかれさん!誕生から初めての年末調整まで、よう頑張った。`,
      'この先は結婚、住宅、副業、老後……と、お金のイベントはまだまだ続く。第2部をお楽しみに!',
    ],
  },
}

export function stageIndex(sceneId: string): number {
  return STAGES.indexOf(SCENES[sceneId]?.stage ?? '誕生')
}
