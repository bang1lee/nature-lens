import { koreanFieldStories } from './korean-field-stories';
// Entries are authored summaries, keyed by exact species names; do not infer from a genus.
export type SpeciesStory = {
  scientificName: string;
  koreanName?: string;
  reviewStatus: 'unreviewed';
  story?: string;
  fact?: string;
  meaning?: string;
  symbolism?: string;
  designation?: { notice: string; url: string };
  seasons?: { label: string; observation: string }[];
  caution?: { url: string; source: string };
  sources: { title: string; url: string; author: string; license: string }[];
};
const legalSource = {
  title: '생태계교란 생물 지정 고시 별표',
  url: 'https://www.law.go.kr/LSW/flDownload.do?bylClsCd=200201&flSeq=158435855',
  author: '환경부',
  license: '법령 원문',
};
const listedSpecies = [
  'Sicyos angulatus',
  'Ambrosia trifida',
  'Ambrosia artemisiifolia',
  'Ageratina altissima',
  'Humulus japonicus',
];
const listedStories: SpeciesStory[] = listedSpecies.map((scientificName) => ({
  scientificName,
  reviewStatus: 'unreviewed',
  designation: { notice: '환경부고시 제2025-165호 · 2025. 10. 7. 시행', url: legalSource.url },
  sources: [legalSource],
}));
export const stories: SpeciesStory[] = [
  {
    scientificName: 'Forsythia koreana',
    reviewStatus: 'unreviewed',
    symbolism:
      '농촌진흥청 자료에는 개나리의 꽃말이 ‘희망’으로 소개돼요. 꽃말은 문화에 따라 달라질 수 있어요.',
    sources: [
      {
        title: '정원에서 관찰할 수 있는 꽃과 꽃말',
        url: 'https://www.rda.go.kr/download_file/act/bookcafe056.PDF',
        author: '농촌진흥청',
        license: '원문 출처 참조',
      },
      {
        title: '한국 자생식물 영문명 목록',
        url: 'https://www.forest.go.kr/kna/special/download/English_Names_for_Korean_Native_Plants.pdf',
        author: '국립수목원',
        license: '원문 출처 참조',
      },
    ],
  },
  {
    scientificName: 'Rhododendron mucronulatum',
    reviewStatus: 'unreviewed',
    story: '봄 산에서 잎보다 먼저 꽃이 피는 모습을 찾아보세요.',
    fact: '잎은 가지에 어긋나고 열매는 가을에 익어요.',
    symbolism:
      '농촌진흥청 자료에는 진달래의 꽃말이 ‘절제’로 소개돼요. 꽃말은 문화에 따라 달라질 수 있어요.',
    seasons: [
      { label: '3월 말–4월 말', observation: '잎보다 먼저 피는 붉은빛 꽃을 관찰해 보세요.' },
      { label: '11월', observation: '익어가는 열매를 살펴보세요.' },
    ],
    sources: [
      {
        title: 'DMZ 비밀의 숲 · 진달래',
        url: 'https://www.forest.go.kr/newkfsweb/cmm/fms/BoardFileDown.do?atchFileId=FILE_000000000735743&bbsId=&dwldHistYn=&fileSn=0&fn=DMZ',
        author: '산림청',
        license: '원문 출처 참조',
      },
      {
        title: '정원에서 관찰할 수 있는 꽃과 꽃말',
        url: 'https://www.rda.go.kr/download_file/act/bookcafe056.PDF',
        author: '농촌진흥청',
        license: '원문 출처 참조',
      },
    ],
  },
  {
    scientificName: 'Hibiscus syriacus',
    reviewStatus: 'unreviewed',
    story: '한 송이는 대개 아침에 피고 저녁에 오므라들지만, 계절 동안 새로운 꽃이 이어져요.',
    symbolism:
      '산림청 자료는 무궁화의 꽃말을 ‘끈기와 일편단심’으로 소개해요. 꽃말은 문화에 따라 달라질 수 있어요.',
    seasons: [{ label: '7월 초–10월 초', observation: '가지에 차례로 피어나는 꽃을 살펴보세요.' }],
    sources: [
      {
        title: '무궁화 식물 정보',
        url: 'https://nfsv.forest.go.kr/kfs/images/data/down/imsan/imsan_06_05.pdf',
        author: '산림청',
        license: '원문 출처 참조',
      },
      {
        title: '산림문화유산 답사기',
        url: 'https://www.forest.go.kr/kfsweb/cop/bbs/selectBoardArticle.do?bbsId=BBSMSTR_1069&mn=NKFS_06_09_01&nttId=412374',
        author: '산림청',
        license: '원문 출처 참조',
      },
    ],
  },
  {
    scientificName: 'Pinus densiflora',
    reviewStatus: 'unreviewed',
    story: '가느다란 잎이 둘씩 모여 난 가지와 붉은빛 나무껍질을 함께 살펴보세요.',
    fact: '바늘 모양 잎을 지닌 늘푸른 나무예요.',
    sources: [
      {
        title: '소나무 식물 정보',
        url: 'https://plants.ces.ncsu.edu/plants/pinus-densiflora/',
        author: 'North Carolina State University Extension',
        license: '원문 출처 참조',
      },
    ],
  },
  {
    scientificName: 'Acer palmatum',
    reviewStatus: 'unreviewed',
    story: '손바닥처럼 갈라진 잎을 따라가다 보면 작은 꽃과 날개 달린 열매도 눈에 들어와요.',
    fact: '잎은 마주나고 보통 다섯에서 아홉 갈래로 갈라져요.',
    meaning: '학명의 palmatum은 손바닥 모양을 뜻하며 잎의 모습을 가리켜요.',
    seasons: [
      { label: '봄', observation: '작고 붉은빛이 도는 꽃을 살펴보세요.' },
      { label: '가을', observation: '날개 달린 열매와 변하는 잎빛을 살펴보세요.' },
    ],
    sources: [
      {
        title: '단풍나무 식물 정보',
        url: 'https://plants.ces.ncsu.edu/plants/acer-palmatum/',
        author: 'North Carolina State University Extension',
        license: '원문 출처 참조',
      },
    ],
  },
  {
    scientificName: 'Taraxacum officinale',
    reviewStatus: 'unreviewed',
    story: '노란 꽃이 진 뒤 둥근 솜털 모양의 열매 머리가 생겨 바람에 흩어져요.',
    fact: '잎은 땅 가까이에서 돌려나듯 모이고 가장자리가 깊게 갈라져요.',
    meaning: '영어 이름 dandelion은 잎의 톱니를 사자의 이빨에 빗댄 말에서 왔어요.',
    seasons: [{ label: '봄', observation: '노란 꽃과 꽃을 찾는 곤충을 관찰해 보세요.' }],
    sources: [
      {
        title: '서양민들레 식물 정보',
        url: 'https://plants.ces.ncsu.edu/plants/taraxacum-officinale/',
        author: 'North Carolina State University Extension',
        license: '원문 출처 참조',
      },
    ],
  },
  {
    scientificName: 'Convallaria keiskei',
    reviewStatus: 'unreviewed',
    seasons: [
      { label: '4–5월', observation: '꽃이 피는 시기예요. 멀리서 조심스럽게 관찰해 보세요.' },
    ],
    caution: {
      url: 'https://north.forest.go.kr/kfsweb/cop/bbs/selectBoardArticle.do?bbsId=BBSMSTR_1009&mn=UNRT_03_03&nttId=59686',
      source: '북부지방산림청 은방울꽃 자료',
    },
    sources: [
      {
        title: '은방울꽃 식물 정보',
        url: 'https://north.forest.go.kr/kfsweb/cop/bbs/selectBoardArticle.do?bbsId=BBSMSTR_1009&mn=UNRT_03_03&nttId=59686',
        author: '북부지방산림청',
        license: '원문 출처 참조',
      },
    ],
  },
];
export function getSpeciesStory(scientificName: string, rank: string): SpeciesStory | undefined {
  if (rank !== 'species') return undefined;
  const key = scientificName.trim().replace(/\s+/g, ' ').toLowerCase();
  return [...stories, ...listedStories, ...koreanFieldStories].find(
    (item) => item.scientificName.toLowerCase() === key,
  );
}

export const speciesStoryCatalog: readonly SpeciesStory[] = [
  ...stories,
  ...listedStories,
  ...koreanFieldStories,
];
