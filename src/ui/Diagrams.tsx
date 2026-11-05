/** 「やさしい解説」に添える簡単な図(文字と矢印だけで、色に頼らない) */
export function Diagram({ name }: { name: string }) {
  switch (name) {
    case 'salaryFlow':
      return (
        <figure>
          <div className="diagram" aria-label="額面から手取りまでの流れ">
            <span className="box">額面<br />(会社が払う全額)</span>
            <span className="arrow">−</span>
            <span className="box">社会保険料<br />(健康保険・年金・雇用保険)</span>
            <span className="arrow">−</span>
            <span className="box">所得税<br />(毎月は概算)</span>
            <span className="arrow">−</span>
            <span className="box">住民税<br />(前年の所得から)</span>
            <span className="arrow">=</span>
            <span className="box"><strong>手取り</strong></span>
          </div>
        </figure>
      )
    case 'taxSteps':
      return (
        <figure>
          <div className="diagram" aria-label="所得税の計算の順番">
            <span className="box">収入</span>
            <span className="arrow">→ 給与所得控除を引く →</span>
            <span className="box">所得</span>
            <span className="arrow">→ 所得控除を引く →</span>
            <span className="box">課税所得</span>
            <span className="arrow">→ × 税率 →</span>
            <span className="box"><strong>税額</strong></span>
          </div>
        </figure>
      )
    case 'residentTiming':
      return (
        <figure>
          <table aria-label="住民税を払うタイミング">
            <thead>
              <tr><th>所得を得た年</th><th>住民税を払う時期</th></tr>
            </thead>
            <tbody>
              <tr><td>1年目(1〜12月)</td><td>2年目の6月 〜 3年目の5月</td></tr>
              <tr><td>2年目(1〜12月)</td><td>3年目の6月 〜 4年目の5月</td></tr>
            </tbody>
          </table>
        </figure>
      )
    case 'yearEndFlow':
      return (
        <figure>
          <div className="diagram" aria-label="年末調整の流れ">
            <span className="box">毎月の天引き<br />(概算)の合計</span>
            <span className="arrow">と</span>
            <span className="box">控除を入れた<br />正しい年税額</span>
            <span className="arrow">の差 →</span>
            <span className="box">多すぎ:還付 ↩<br />足りない:追徴</span>
          </div>
        </figure>
      )
    case 'insurancePie':
      return (
        <figure>
          <div className="diagram" aria-label="社会保険料は会社と半分ずつ">
            <span className="box">保険料の全額</span>
            <span className="arrow">=</span>
            <span className="box">あなたの負担<br />(明細に出る)</span>
            <span className="arrow">+</span>
            <span className="box">会社の負担<br />(明細に出ない)</span>
          </div>
        </figure>
      )
    default:
      return null
  }
}
