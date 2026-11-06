import { analyzeStudentJob, man, yen } from '../engine'
import type { GameState, GaugeDelta } from '../game/types'
import { rulesFor } from '../game/state'
import {
  chooseHighSchoolJob,
  chooseUniJob,
  HIGH_SCHOOL_JOB_OPTIONS,
  UNI_JOB_OPTIONS,
  uniJobMarginals,
  uniJobSweetSpot,
} from '../game/actions'

export interface MissionOption {
  id: string
  label: string
  detail?: string
  ok: boolean
  /** ゼイ吉のひとこと(短く) */
  feedback: string
  /** 選んだ時点で反映され、やり直しても戻らない変化(ズルを選んだときの徳の減少など) */
  penalty?: GaugeDelta
}

export interface Mission {
  id: string
  /** クリア条件 */
  goal: string
  /** 問いかけ */
  question: (s: GameState) => string
  /** ヒント(見ると★が1つ減る) */
  hint: string
  /** クリアするともらえる知識カード */
  card: string
  /** クリアしたときのゲージ変化 */
  reward: GaugeDelta
  /** 選択肢。ない場合は画面ごとの専用UIで判定する */
  options?: (s: GameState) => MissionOption[]
  /** 正解を選んだときのゲーム上の処理 */
  onClear?: (s: GameState, optionId: string) => GameState
}

const hsLabel = (x: number) =>
  x === 0 ? 'バイトしない' : x <= 400_000 ? '週2日' : x <= 900_000 ? '週4日' : x <= 1_250_000 ? '週5日' : 'ほぼ毎日'

const uniLabel = (x: number) =>
  x <= 700_000 ? '週2日' : x <= 1_200_000 ? '週3日' : x <= 1_400_000 ? '週3〜4日' : x <= 1_600_000 ? '週4日' : x <= 1_800_000 ? '週5日' : 'ほぼ毎日'

export const MISSIONS: Record<string, Mission> = {
  birthApply: {
    id: 'birthApply',
    goal: 'もらえるお金を取りこぼすな',
    question: () => '赤ちゃん誕生!親がまずやることは?',
    hint: 'お金を出すのは国。でも窓口は住んでいる市区町村。しかも、自分から言わないと……',
    card: 'birth',
    reward: { money: 6, toku: 5 },
    options: () => [
      {
        id: 'wait',
        label: '何もしない。自動で振り込まれる',
        ok: false,
        feedback: '待っても来ーへんで!児童手当は「申請」せんともらえへん。',
      },
      {
        id: 'apply',
        label: '市区町村に出生届と児童手当の申請を出す',
        ok: true,
        feedback: '正解!児童手当は申請が必要や。生まれて15日以内が目安やで。',
      },
      {
        id: 'zeimusho',
        label: '税務署に出生届を出す',
        ok: false,
        feedback: '出生届は税務署ちゃう、市区町村や!',
      },
    ],
  },

  gift: {
    id: 'gift',
    goal: '贈与税を0円にしよう',
    question: () => 'おじいちゃんが「入学祝いに200万円あげたい」。どう受け取る?',
    hint: '贈与税は、もらった人ごとに1年110万円まで0円。それと「学費」には特別なルールがあるで。',
    card: 'otoshidama',
    reward: { money: 6, toku: 5 },
    options: () => [
      {
        id: 'lump',
        label: '一度に200万円もらう',
        ok: false,
        feedback: '110万円を超えた90万円に税金や。贈与税が9万円かかってまう!',
      },
      {
        id: 'tuition',
        label: '学費が必要なときに、そのつど払ってもらう',
        ok: true,
        feedback: '正解!必要なときに払ってもらう学費には、贈与税はかからへん。',
      },
      {
        id: 'secret',
        label: '現金でこっそりもらえばバレない',
        ok: false,
        feedback: 'アカン!ナイショでも税金のルールは同じや。ズルは徳が下がるで。',
        penalty: { toku: -15 },
      },
    ],
  },

  hsJob: {
    id: 'hsJob',
    goal: '親の税金も自分の保険料も増やさず、いちばん多く稼げ',
    question: () => '高校生のバイト、年収はどれくらいにする?(2年間つづけます)',
    hint: '16歳から親は「扶養控除」が使える。子の年収が136万円を超えると使えへん。保険の扶養は130万円が境目や。',
    card: 'highschool',
    reward: { money: 6 },
    options: (s) => {
      const r = rulesFor(s, 16)
      const rows = HIGH_SCHOOL_JOB_OPTIONS.map((x) => ({ x, a: analyzeStudentJob(x, 16, s.parentSalary, r) }))
      const safe = rows.filter((r) => r.a.parentTaxIncrease === 0 && r.a.ownHealthInsurance === 0)
      const best = Math.max(...safe.map((r) => r.x))
      return rows.map(({ x, a }) => {
        const harm = a.parentTaxIncrease > 0 || a.ownHealthInsurance > 0
        return {
          id: String(x),
          label: x === 0 ? 'バイトしない' : `年${man(x)}`,
          detail: hsLabel(x),
          ok: x === best,
          feedback:
            x === best
              ? `正解!${man(x)}なら親にも自分にも負担なし。136万円と130万円の壁の手前や。`
              : harm
                ? `親の税金が年${yen(a.parentTaxIncrease)}増えて、自分も保険料${yen(a.ownHealthInsurance)}を払うことに!`
                : 'まだ余裕あるで。もっと稼いでも親に迷惑はかからへん。',
        }
      })
    },
    onClear: (s, id) => chooseHighSchoolJob(s, Number(id)),
  },

  scholarship: {
    id: 'scholarship',
    goal: '奨学金のワナを見抜け',
    question: () => '「貸与型」の奨学金って、どんなお金?',
    hint: '「貸」という字に注目や。',
    card: 'scholarship',
    reward: { money: 4 },
    options: () => [
      { id: 'free', label: '返さなくていいお金', ok: false, feedback: 'それは「給付型」や。貸与型は返すんやで。' },
      { id: 'loan', label: '卒業後に自分で返す借金', ok: true, feedback: '正解!月々の手取りから返していくんや。' },
      { id: 'company', label: '就職した会社が全部返してくれる', ok: false, feedback: '肩代わりしてくれる会社もあるけど、ふつうは自分で返すんや。' },
    ],
  },

  walls: {
    id: 'walls',
    goal: '「働き損」にならない、いちばん多い年収を選べ',
    question: () => '大学生のバイト、年収はどれくらいにする?(4年間つづけます)',
    hint: '19〜22歳は、年収150万円から親の健康保険を抜けて自分で保険料を払う。カードの「壁マップ」を見てみ。',
    card: 'walls',
    reward: { money: 8 },
    options: (s) => {
      const sweet = uniJobSweetSpot(s)
      const m = uniJobMarginals(s)
      const sweetNet = m.find((x) => x.analysis.salary === sweet)!.analysis.familyNet
      return UNI_JOB_OPTIONS.map((x) => {
        const a = m.find((y) => y.analysis.salary === x)!.analysis
        const diff = a.familyNet - sweetNet
        return {
          id: String(x),
          label: `年${man(x)}`,
          detail: uniLabel(x),
          ok: x === sweet,
          feedback:
            x === sweet
              ? `正解!${man(x)}が壁の手前。これ以上は保険料と親の税金で目減りするで。`
              : x < sweet
                ? 'まだ壁の手前。もっと働いても手取りはちゃんと増えるで。'
                : diff > 0
                  ? `${man(x - sweet)}多く働いても、家族の手取りは${man(diff)}しか増えへん。働き損や!`
                  : `${man(x - sweet)}多く働いたのに、家族の手取りは${man(-diff)}減ってまう!`,
        }
      })
    },
    onClear: (s, id) => chooseUniJob(s, Number(id)),
  },

  takeHome: {
    id: 'takeHome',
    goal: '初任給の手取りを当てろ',
    question: (s) => `月給${man(s.job?.company.monthly ?? 0)}。銀行に振り込まれるのは?`,
    hint: '健康保険・年金・雇用保険・所得税が引かれる。だいたい2割や。',
    card: 'payslip',
    reward: { money: 4 },
    options: (s) => {
      const p = s.job?.payslips[0]
      const g = p?.gross ?? 0
      const n = p?.net ?? 0
      const fmt = (v: number) => `約${(Math.round(v / 1000) / 10).toFixed(1)}万円`
      return [
        { id: 'gross', label: fmt(g), ok: false, feedback: '全額は入らへん。保険料と税金が先に引かれるんや。' },
        { id: 'net', label: fmt(n), ok: true, feedback: `正解!額面の約${Math.round((n / g) * 100)}%が手取りや。` },
        { id: 'low', label: fmt(g * 0.62), ok: false, feedback: 'そこまでは引かれへん。1年目は住民税もまだやしな。' },
      ]
    },
  },

  residentQuiz: {
    id: 'residentQuiz',
    goal: '住民税のタイミングを見抜け',
    question: () => '6月から給料で引かれる住民税。どの年の収入にかかる税金?',
    hint: '住民税は「おくれてやってくる」税金や。',
    card: 'resident',
    reward: { money: 4, toku: 5 },
    options: () => [
      { id: 'this', label: '今年の収入', ok: false, feedback: 'ちゃうねん。今年の分は、来年の6月からや。' },
      { id: 'last', label: '去年の収入', ok: true, feedback: '正解!住民税は1年おくれ。2年目に手取りが減るのはこのせいや。' },
      { id: 'next', label: '来年の収入(前払い)', ok: false, feedback: '前払いはないで。逆や、後払いや。' },
    ],
  },

  yearEnd: {
    id: 'yearEnd',
    goal: '年末調整で、戻るお金を満額取り戻せ',
    question: () => '会社に出す書類を選んで、申告書を書こう。',
    hint: '保険料やiDeCoの「証明書」は出す。医療費は年末調整では使えへん。金額は「12月までの見込み」を書くんや。',
    card: 'yearEnd',
    reward: { money: 10, toku: 10 },
  },

  kakutei: {
    id: 'kakutei',
    goal: '確定申告で、取りこぼしたお金を取り返せ',
    question: () => '申告する控除を選んで送信しよう。',
    hint: '医療費は1年で10万円を超えた分が控除になる。年末調整で出し忘れた控除もここで申告できるで。',
    card: 'finalReturn',
    reward: { money: 8, toku: 10 },
  },
}
