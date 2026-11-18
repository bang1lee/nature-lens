import type { SpeciesStory } from '@/lib/species-stories';

export default function PublicSpeciesDetail({
  scientificName,
  observations,
  story,
}: {
  scientificName: string;
  observations: number;
  story?: SpeciesStory;
}) {
  const hasStory = Boolean(story?.story || story?.fact || story?.meaning || story?.symbolism);
  return (
    <article>
      <h2>
        {story?.koreanName || '확인된 종'}{' '}
        <small>
          <i>{scientificName}</i>
        </small>
      </h2>
      <p>전문가가 확인한 공개 관찰 {observations}건</p>
      <nav aria-label="종 상세 목차">
        <h3>이 페이지에서</h3>
        <ul>
          <li>
            <a href="#species-story">종 이야기</a>
          </li>
          <li>
            <a href="#species-season">계절 관찰</a>
          </li>
          <li>
            <a href="#species-observations">공개 관찰</a>
          </li>
          <li>
            <a href="#species-notice">주의와 출처</a>
          </li>
        </ul>
      </nav>
      <p>아래 종 정보는 관찰의 전문가 확인과 별도로 작성되었으며 전문가 검수 전입니다.</p>
      <section id="species-story">
        <h3>종 이야기</h3>
        {hasStory ? (
          <>
            {story?.story && <p>{story.story}</p>}
            {story?.fact && <p>{story.fact}</p>}
            {story?.meaning && <p>{story.meaning}</p>}
            {story?.symbolism && <p>{story.symbolism}</p>}
          </>
        ) : (
          <p>아직 출처를 확인한 종 이야기가 없어요.</p>
        )}
      </section>
      <section id="species-season">
        <h3>계절에 따라 살펴보기</h3>
        {story?.seasons?.length ? (
          <>
            <ul>
              {story.seasons.map((s) => (
                <li key={s.label}>
                  <strong>{s.label}</strong> · {s.observation}
                </li>
              ))}
            </ul>
            <p>시기는 지역과 날씨에 따라 달라질 수 있어요.</p>
          </>
        ) : (
          <p>아직 확인된 계절 관찰 정보가 없어요.</p>
        )}
      </section>
      <section id="species-observations">
        <h3>공개 관찰</h3>
        <p>공개에 동의하고 전문가가 확인한 관찰 {observations}건이 있어요.</p>
        <p>
          개인의 사진·메모와 위치는 이 페이지에 표시하지 않아요. 관찰 지역을 나타낼 근거도 아직
          제공하지 않습니다.
        </p>
      </section>
      <section id="species-notice">
        <h3>주의와 출처</h3>
        {story?.caution && (
          <p>
            <strong>주의가 알려진 식물</strong> · 참고용 정보예요. 종과 주의 사항은 전문가에게
            확인해 주세요.{' '}
            <a href={story.caution.url} target="_blank" rel="noreferrer">
              {story.caution.source}
            </a>
          </p>
        )}
        {story?.designation && (
          <p>
            <strong>생태계교란 생물로 지정된 종</strong> · 전문가에게 확인하고 지역 환경 담당 기관에
            알려 주세요. 함부로 옮기지 마세요.{' '}
            <a href={story.designation.url} target="_blank" rel="noreferrer">
              고시 별표
            </a>{' '}
            · {story.designation.notice}
          </p>
        )}
        {!story?.caution && !story?.designation && (
          <p>이 종에 대해 연결된 주의 자료가 아직 없어요.</p>
        )}
        {story?.sources.length ? (
          <>
            <h4>종 정보 출처</h4>
            <ul>
              {story.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>{' '}
                  · {s.author} · {s.license}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>연결된 종 정보 출처가 아직 없어요.</p>
        )}
      </section>
    </article>
  );
}
