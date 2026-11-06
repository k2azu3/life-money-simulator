import type { CalcStep } from '../engine'
import { childAllowanceTotal, computeResidentTax, man } from '../engine'
import type { GameState, GaugeDelta } from '../game/types'
import { addCard, addGauges, rulesFor, yearOf } from '../game/state'
import { chooseOtoshidama, choosePath, enterBirth, jobStartAge } from '../game/actions'

export type SceneKind =
  | 'story'
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
  /** 選ぶとゲージがどう動くか(画面にも表示する) */
  effect?: GaugeDelta
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
  /** 見出しの上に出す「2032年・6歳」など */
  when: (s: GameState) => string
  title: (s: GameState) => string
  /** ゼイ吉のセリフ。1つ1文、2〜3つまで */
  lines: (s: GameState) => string[]
  facts?: (s: GameState) => { label: string; value: string; who?: string }[]
  /** この場面のミッション(content/missions.ts のID)。クリアするまで先に進めない */
  mission?: string
  why?: (s: GameState) => WhyBlock[]
  choices?: (s: GameState) => Choice[]
  onEnter?: (s: GameState) => GameState
}

const go = (sceneId: string) => (s: GameState): GameState => ({ ...s, sceneId })
/** ゲージを動かしてから次の場面へ */
const pick = (sceneId: string, effect: GaugeDelta | undefined, f: (s: GameState) => GameState = (s) => s): Choice['act'] =>
  (s) => go(sceneId)(addGauges(f(s), effect))

export const STAGES = ['誕生', '子ども時代', '高校生', '進路', '大学生', '就職', '年末調整', 'まとめ']

export const SCENES: Record<string, Scene> = {
  birth: {
    id: 'birth',
    kind: 'story',
    stage: '誕生',
    when: (s) => `${yearOf(s, 0)}年・0歳`,
    title: () => 'あなたはここに生まれました',
    onEnter: enterBirth,
    lines: (s) => [`おぎゃー!${s.name}さん、誕生おめでとさん!ワイはお金の妖精ゼイ吉や。`, 'さっそく最初のミッションや。'],
    mission: 'birthApply',
    facts: (s) => {
      const r = rulesFor(s, 0)
      return [
        { label: '出産育児一時金', value: man(r.benefits.birthLumpSum), who: '健康保険から' },
        { label: '児童手当 18歳までの合計', value: man(childAllowanceTotal(1, r)), who: '国から(申請が必要)' },
      ]
    },
    choices: () => [{ label: 'すくすく育つ(6歳へ)', act: go('otoshidama') }],
  },
  otoshidama: {
    id: 'otoshidama',
    kind: 'story',
    stage: '子ども時代',
    when: (s) => `${yearOf(s, 6)}年・6歳`,
    title: () => 'おじいちゃんからのお祝い',
    lines: () => ['小学校入学や!おじいちゃんがお祝いをくれるって。', 'でも、もらい方しだいで税金がかかるんや。'],
    mission: 'gift',
    choices: () => [
      {
        label: 'お年玉は全部貯金する',
        detail: '10年分で30万円',
        effect: { money: 5, happy: -2 },
        act: pick('highschool', { money: 5, happy: -2 }, (s) => chooseOtoshidama(s, 'all')),
      },
      {
        label: '半分貯金、半分使う',
        detail: '15万円を貯金',
        effect: { money: 2, happy: 4 },
        act: pick('highschool', { money: 2, happy: 4 }, (s) => chooseOtoshidama(s, 'half')),
      },
      {
        label: '全部使う!',
        detail: 'ゲームにマンガに……',
        effect: { happy: 8 },
        act: pick('highschool', { happy: 8 }, (s) => chooseOtoshidama(s, 'none')),
      },
    ],
  },
  highschool: {
    id: 'highschool',
    kind: 'story',
    stage: '高校生',
    when: (s) => `${yearOf(s, 16)}年・16歳`,
    title: () => 'アルバイトを始める',
    lines: (s) => [
      s.flags.lottery ? '子どものころ宝くじで1万円当たったな。あれは税金ゼロや。' : '高校生や!バイトしてみよか。',
      'ただし稼ぎすぎると、親に迷惑がかかるで。',
    ],
    mission: 'hsJob',
    choices: () => [{ label: '18歳へ(進路を決める)', act: go('path') }],
  },
  path: {
    id: 'path',
    kind: 'story',
    stage: '進路',
    when: (s) => `${yearOf(s, 18)}年・18歳`,
    title: () => '進路を決める',
    lines: (s) => [`高校卒業や!貯金は${man(s.savings)}。`, '大学なら奨学金を借りる手もある。でも、その前に……'],
    mission: 'scholarship',
    choices: () => [
      {
        label: '大学に進学する',
        detail: '学費は親が出してくれる',
        effect: { happy: 5 },
        act: pick('university', { happy: 5 }, (s) => choosePath(s, 'university')),
      },
      {
        label: '大学に進学+奨学金を借りる',
        detail: '月5万円×4年=240万円の借金',
        effect: { money: -4, happy: 8 },
        act: pick('university', { money: -4, happy: 8 }, (s) => choosePath(s, 'universityLoan')),
      },
      {
        label: '高校を出て就職する',
        detail: '18歳で社会人デビュー',
        effect: { money: 6 },
        act: pick('company', { money: 6 }, (s) => choosePath(s, 'work')),
      },
    ],
  },
  university: {
    id: 'university',
    kind: 'story',
    stage: '大学生',
    when: (s) => `${yearOf(s, 19)}年・19歳`,
    title: () => 'バイト年収と「年収の壁」',
    lines: () => ['大学生や!シフトをどれくらい入れる?', '「103万円の壁」はもう昔の話。今の壁、知っとる?'],
    mission: 'walls',
    choices: () => [{ label: '卒業して就職活動へ', act: go('company') }],
  },
  company: {
    id: 'company',
    kind: 'company',
    stage: '就職',
    when: (s) => `${yearOf(s, jobStartAge(s))}年・${jobStartAge(s)}歳`,
    title: () => '就職先を選ぶ',
    lines: (s) => [
      s.flags.path === 'work' ? '18歳で社会人デビューや!' : '大学卒業おめでとう!',
      '内定は2社。月給だけやなく、ボーナスも見て比べるんやで。',
    ],
  },
  payslip: {
    id: 'payslip',
    kind: 'payslip',
    stage: '就職',
    when: () => '4月',
    title: () => 'はじめての給与明細',
    lines: () => ['初任給や!でも、振り込まれる額は月給とちゃうで。'],
    mission: 'takeHome',
  },
  firstYearChoices: {
    id: 'firstYearChoices',
    kind: 'firstYearChoices',
    stage: '就職',
    when: () => '5月',
    title: () => '社会人の「そなえ」',
    lines: () => ['保険やiDeCoをすすめられたで。', '払うと税金が安くなるものもある。12月に効いてくるで。'],
    onEnter: (s) => addCard(s, 'firstYearChoices'),
  },
  june: {
    id: 'june',
    kind: 'story',
    stage: '就職',
    when: () => '6月',
    title: () => '住民税の通知と、病院の領収書',
    lines: (s) => {
      const levy = s.residentLevies[yearOf(s, (s.job?.age ?? 22) - 1)] ?? 0
      return [
        levy > 0 ? `給料から住民税が月${Math.floor(levy / 12).toLocaleString()}円引かれ始めたで。` : '住民税の通知が来たで。今年は0円や。',
        s.flags.injured
          ? `それと、階段で骨折したんやて!?医療費は${man(s.flags.medicalExpenses ?? 0)}になりそうや。`
          : `それと、歯医者に行ったんやな。医療費は${man(s.flags.medicalExpenses ?? 0)}や。`,
      ]
    },
    mission: 'residentQuiz',
    why: (s) => {
      const age = (s.job?.age ?? 22) - 1
      const rec = s.records.find((r) => r.age === age)
      if (!rec) return []
      const r = computeResidentTax(
        { salaryGross: rec.gross, socialInsurance: rec.socialInsurance, workingStudent: age <= 22, minor: age < 18 },
        rulesFor(s, age),
      )
      return [{ title: `${age}歳のときの収入${man(rec.gross)}に対する住民税`, steps: r.steps }]
    },
    choices: (s) => [
      {
        label: '病院の領収書はとっておく',
        detail: '引き出しにしまう',
        act: (x) => go('yearEnd')(addCard({ ...x, flags: { ...x.flags, keptReceipts: true } }, 'medical')),
      },
      {
        label: '領収書は捨てる',
        detail: s.flags.injured ? '部屋がスッキリ' : 'どうせ使わへんし',
        effect: { happy: 2 },
        act: pick('yearEnd', { happy: 2 }, (x) => ({ ...x, flags: { ...x.flags, keptReceipts: false } })),
      },
    ],
  },
  yearEnd: {
    id: 'yearEnd',
    kind: 'yearEnd',
    stage: '年末調整',
    when: () => '12月',
    title: () => 'はじめての年末調整',
    lines: () => ['会社から「年末調整の書類を出して」やって。', '出し忘れたら、戻るはずのお金が戻らへんで!'],
  },
  finalReturn: {
    id: 'finalReturn',
    kind: 'finalReturn',
    stage: '年末調整',
    when: (s) => `${yearOf(s, (s.job?.age ?? 22) + 1)}年2月`,
    title: () => '確定申告',
    lines: (s) =>
      s.yearEnd?.submitted
        ? ['年末調整で取りこぼした分は、確定申告で取り返せるで。']
        : ['年末調整を出さへんかったんか……。でも確定申告で取り返せるで。'],
  },
  summary: {
    id: 'summary',
    kind: 'summary',
    stage: 'まとめ',
    when: () => '社会人1年目',
    title: () => '1年のまとめ',
    lines: () => ['1年おつかれさん!お金の流れを図にしたで。'],
  },
  end: {
    id: 'end',
    kind: 'end',
    stage: 'まとめ',
    when: () => '第1部',
    title: () => 'エンディング',
    lines: (s) => [`${s.name}さん、ここまでおつかれさん!`, '結婚、家、副業、老後……お金の冒険はまだまだ続くで。'],
  },
}

export function stageIndex(sceneId: string): number {
  return STAGES.indexOf(SCENES[sceneId]?.stage ?? '誕生')
}
