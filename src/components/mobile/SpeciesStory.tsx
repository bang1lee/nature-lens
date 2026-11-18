import { getSpeciesStory } from '../../lib/species-stories';
import './species-story.css';

export default function SpeciesStory({
  scientificName,
  rank,
}: {
  scientificName: string;
  rank: string;
}) {
  const story = getSpeciesStory(scientificName, rank);
  if (!story) return null;
  return (
    <section className="nl-species-story" aria-label="후보 종 이야기">
      <h4>이 후보의 이야기</h4>
      <p className="nl-species-review">후보가 맞을 때 참고하는 정보 · 전문가 검수 전</p>
      {story.story && <p>{story.story}</p>}
      {story.fact && (
        <p>
          <strong>자세히 보기</strong> {story.fact}
        </p>
      )}
      {story.symbolism && (
        <p>
          <strong>꽃말</strong> {story.symbolism}
        </p>
      )}
      {story.meaning && (
        <p>
          <strong>이름 이야기</strong> {story.meaning}
        </p>
      )}
      {story.seasons && (
        <>
          <h5>계절에 따라 살펴보기</h5>
          <ul>
            {story.seasons.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong> {item.observation}
              </li>
            ))}
          </ul>
          <small>시기는 지역과 날씨에 따라 달라질 수 있어요.</small>
        </>
      )}
      {story.designation && (
        <div className="nl-species-caution">
          <strong>생태계교란 생물로 지정된 종</strong>
          <p>
            후보가 맞는지 전문가에게 확인하고, 관찰 내용을 지역 환경 담당 기관에 알려 주세요. 함부로
            옮기지 마세요.
          </p>
          <a href={story.designation.url} target="_blank" rel="noreferrer">
            고시 별표 보기 ↗
          </a>
          <small>{story.designation.notice}</small>
        </div>
      )}
      {story.caution && (
        <div className="nl-species-caution">
          <strong>주의가 알려진 식물</strong>
          <p>참고용 정보예요. 종과 주의 사항은 전문가에게 확인해 주세요.</p>
          <a href={story.caution.url} target="_blank" rel="noreferrer">
            {story.caution.source} ↗
          </a>
        </div>
      )}
      <details>
        <summary>정보 출처</summary>
        <ul>
          {story.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title} ↗
              </a>
              <small>
                {source.author} · {source.license}
              </small>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
