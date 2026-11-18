import type { SpeciesStory } from './species-stories';

// The linked page numbers refer to the PDF viewer, not the book's printed page numbers.
const dmz =
  'https://www.forest.go.kr/newkfsweb/cmm/fms/BoardFileDown.do?atchFileId=FILE_000000000735743&bbsId=&dwldHistYn=&fileSn=0&fn=DMZ';
function field(
  scientificName: string,
  koreanName: string,
  page: number,
  story: string,
  season?: [string, string],
): SpeciesStory {
  return {
    scientificName,
    koreanName,
    reviewStatus: 'unreviewed',
    story,
    ...(season ? { seasons: [{ label: season[0], observation: season[1] }] } : {}),
    sources: [
      {
        title: `DMZ 비밀의 숲 · ${koreanName}`,
        url: `${dmz}#page=${page}`,
        author: '산림청',
        license: '원문 출처 참조',
      },
    ],
  };
}

export const koreanFieldStories: SpeciesStory[] = [
  field('Pinus koraiensis', '잣나무', 15, '바늘잎이 다섯 개씩 모여 난 모습을 살펴보세요.'),
  field(
    'Juniperus rigida',
    '노간주나무',
    15,
    '바늘 모양 잎이 세 개씩 둘러나는 가지를 관찰해 보세요.',
    ['10–12월', '둥근 열매가 익는 시기예요.'],
  ),
  field('Actinidia arguta', '다래', 40, '덩굴이 다른 나무를 타고 자라는 모습을 살펴보세요.', [
    '10월',
    '열매가 익는 시기예요.',
  ]),
  field('Hypericum ascyron', '물레나물', 40, '가지 끝에서 큰 꽃을 찾아보세요.', [
    '6–8월',
    '노란 바탕에 붉은빛이 도는 꽃을 관찰해 보세요.',
  ]),
  field('Corydalis speciosa', '산괴불주머니', 42, '줄기와 가지 끝에 모여 달리는 꽃을 살펴보세요.', [
    '4–6월',
    '노란 꽃이 피는 시기예요.',
  ]),
  field('Corydalis ternata', '들현호색', 42, '줄기 끝에 모여 달리는 작은 꽃을 살펴보세요.', [
    '4월',
    '붉은 자줏빛 꽃이 피는 시기예요.',
  ]),
  field('Geum aleppicum', '큰뱀무', 50, '줄기나 가지 끝에 모여 피는 꽃을 찾아보세요.', [
    '6–7월',
    '노란 꽃을 살펴볼 수 있어요.',
  ]),
  field('Malus baccata', '야광나무', 50, '꽃이 진 자리에 둥근 열매가 맺히는 변화를 살펴보세요.', [
    '9–10월',
    '열매가 붉거나 노랗게 익는 시기예요.',
  ]),
  field(
    'Rubus crataegifolius',
    '산딸기',
    54,
    '잎이 손바닥처럼 세 갈래에서 다섯 갈래로 나뉘는지 살펴보세요.',
    ['7–8월', '둥근 붉은 열매가 익는 시기예요.'],
  ),
  field(
    'Oxalis corniculata',
    '괭이밥',
    65,
    '긴 잎자루 끝에서 작은 잎 세 장이 펼쳐지는 모습을 살펴보세요.',
    ['5–8월', '노란 꽃이 피는 시기예요.'],
  ),
  field('Geranium thunbergii', '이질풀', 66, '마주나는 잎과 잎에 나타나는 무늬를 살펴보세요.', [
    '8–9월',
    '연한 분홍빛 꽃을 관찰해 보세요.',
  ]),
  field('Acalypha australis', '깨풀', 67, '길가나 빈터에서 뾰족한 잎을 살펴보세요.', [
    '7–8월',
    '갈색 꽃이 피는 시기예요.',
  ]),
  field(
    'Zanthoxylum schinifolium',
    '산초나무',
    68,
    '작은 잎들이 모여 하나의 겹잎을 이루는 모습을 관찰해 보세요.',
    ['8–9월', '연녹색 꽃을 찾아보세요.'],
  ),
  field('Metaplexis japonica', '박주가리', 96, '덩굴과 잎 뒷면의 흰빛을 살펴보세요.', [
    '7–8월',
    '자줏빛 꽃이 피는 시기예요.',
  ]),
  field('Solanum lyratum', '배풍등', 108, '돌담이나 길가에서 자라는 덩굴을 살펴보세요.', [
    '10월',
    '붉게 익는 열매를 멀리서 관찰해 보세요.',
  ]),
  field(
    'Hemistepta lyrata',
    '지칭개',
    131,
    '길가나 빈터에서 머리 모양으로 모여 핀 꽃을 찾아보세요.',
    ['5–7월', '붉은 자줏빛 꽃을 관찰해 보세요.'],
  ),
  field('Lilium lancifolium', '참나리', 146, '아래를 향해 달리고 뒤로 말리는 꽃잎을 살펴보세요.', [
    '7–8월',
    '붉은빛 꽃이 피는 시기예요.',
  ]),
  field(
    'Pennisetum alopecuroides',
    '수크령',
    164,
    '길가의 양지에서 모여 자라는 풀과 촘촘한 꽃차례를 찾아보세요.',
    ['8월', '꽃이 피는 시기예요.'],
  ),
];
