import type { Observation } from '@/lib/domain';
import { phaseLabels, seasonalTrend } from '@/lib/seasonal-trend';

export default function SeasonalTrend({
  records,
  scientificName,
}: {
  records: Observation[];
  scientificName: string;
}) {
  const samples = seasonalTrend(records, scientificName);
  return (
    <section className="m-field-notes" aria-label="이 종의 내 계절 관찰">
      <h2>이 종의 내 계절 관찰</h2>
      <p>
        이 기기에서 같은 학명으로 기록하고 직접 단계를 선택한 관찰만 모아요. 이름이 미확정일 수
        있어요.
      </p>
      {samples.length ? (
        <>
          <p>기록 {samples.length}건 · 관찰이 없는 달은 표시하지 않아요.</p>
          <ul>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const matches = samples.filter((sample) => sample.month === month);
              return matches.length ? (
                <li key={month}>
                  <strong>
                    {month}월 · {matches.length}건
                  </strong>
                  <ul>
                    {matches.map((sample, index) => (
                      <li key={`${sample.date}-${index}`}>
                        <time dateTime={sample.date}>{sample.date}</time> ·{' '}
                        {phaseLabels[sample.phase]}
                      </li>
                    ))}
                  </ul>
                </li>
              ) : null;
            })}
          </ul>
        </>
      ) : (
        <p>
          아직 생장 단계를 직접 선택한 관찰이 없어요. 관찰 상태에서 꽃봉오리, 꽃 또는 열매를 기록해
          보세요.
        </p>
      )}
    </section>
  );
}
