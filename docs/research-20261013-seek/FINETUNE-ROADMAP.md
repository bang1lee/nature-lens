# 한국 종 평가 · 데이터 권리 · 학습 로드맵

확인 시각: 2026-10-13 KST. 상태: **제안. 학습, 데이터 수집, 유료 서비스 가입은 하지 않았다. 법률 자문 아님.**

가정: 상업 서비스, 1차 범위는 한국에서 흔한 1,000~2,000종, 기기 안 판별. 가정이 바뀌면 데이터 전략이 크게 바뀐다.

## 1. 한국 종 평가 방법
도구는 [claude-workspace](https://github.com/bang1lee/claude-workspace/pull/3)의 `refimpl/`에 있다.
- `fetch_korea_set.py`: iNaturalist 한국 영역 연구등급 관측 중 CC0/CC-BY/CC-BY-NC 사진만 받아 출처와 함께 기록한다.
  - **아는 종**: 모델이 학습한 종이 한국에서 찍힌 사진
  - **모르는 종**: 한국에서 흔하지만 모델에 없는 종의 사진
- `evaluate.py`: 사진마다 최종 답을 **종 / 안전한 상위분류 / 무의미(Life·계) / 오답**으로 나누고, 위치 설정 4가지를 비교한다.
- 상태: 하네스는 사진 2장으로 동작만 확인했다. 실제 수집은 네트워크 정책으로 못 했다.
- 제안 판단 기준
  - 위치 가중치: 모르는 종의 오답률 5% 이하를 지키면서 아는 종의 종 정답률이 가장 높은 값
  - 학습 착수: 아는 종의 종 정답률 60% 미만, 또는 무의미 답 30% 초과
- iNaturalist 데이터는 **내부 측정용으로만** 쓴다(아래 2절).

## 2. 모델·데이터 라이선스
| 대상 | 확인 결과 | 판단 |
|---|---|---|
| SeekReactNative, inatvision 플러그인 | MIT | 알고리즘 참고 가능, 고지 필요 |
| inaturalist/model-files | MIT. 공개 모델은 약 500종 small 모델과 위치 모델뿐, 전종 모델은 비공개(README) | 시험용. 한국 서비스 품질로는 부족 |
| iNaturalist 사진·관측의 AI 학습 | "이용약관이 상업적 AI 학습을 금지한다"는 iNat 측 진술이 보도됨. 약관 원문은 직접 확인 못 함. AWS Open Data 적용 여부는 포럼에서 논쟁 중 | **확인 전까지 학습에 쓰지 않는다** |
| BioCLIP 2 | 가중치 MIT. 학습 데이터에 CC BY-NC가 섞여 있음 | 교사 모델 사용 전 법률 검토 |
| AI Hub | 목록 파일 기준 "출처표시, 상업적 이용금지(공공누리 2유형)" | 데이터셋별 확인 |
| GBIF 이미지 | 기록별 라이선스. 파일은 원 게시처에 있음 | CC0/CC-BY만 필터링 |

"iNaturalist" 이름과 로고는 상표이므로 서비스 이름이나 화면에 쓰지 않는다.

## 3. 접근 방식 비교
| 옵션 | 장점 | 단점 | 기간 |
|---|---|---|---|
| **A. BioCLIP 2 교사 → 모바일 학생 증류 (추천)** | 데이터 적은 종에 강함, 오프라인 | 단계 많음, 교사 데이터 권리 문제 | 8~10주 |
| B. ImageNet 백본을 한국 데이터로 직접 학습 | 단순, 권리 깔끔 | 데이터 적은 종에 약함 | 5~6주 |
| C. BioCLIP 2를 서버에서 추론 | 가장 빠름 | 오프라인 불가, 서버 비용, 사진 전송 | 2~3주 |
| D. 상용 식별 API(현재 Pl@ntNet 설계 포함) | 개발 부담 최소 | 종속, 단가, 한국 종 커버리지 미확인 | 가격 조사 필요 |

## 4. 단계 (옵션 A)
| 단계 | 기간 | 할 일 | 넘어갈 기준 |
|---|---|---|---|
| P0 권리·기준선 | 1주 | 출처별 권리 확인. 샘플 모델과 BioCLIP 2 무학습 성능 측정 | 상업 학습 가능한 데이터로 흔한 1,000종 × 종당 50장 이상 확보 가능 |
| P1 데이터 | 2~3주 | 국가생물종목록 기준 학명 정리. 사진별 라이선스 원장. 중복 제거. 관찰자·위치 단위 분리. 20장 미만 종은 속으로 병합 | 검증셋이 관찰자·지역 단위로 학습셋과 겹치지 않음 |
| P2 교사 | 2주 | BioCLIP 2 분류층 학습 → 일부 층 파인튜닝. 종·속·과 계층 라벨 | 한국 평가셋에서 기준선보다 확실히 높음 |
| P3 학생·경량화 | 2주 | 모바일 백본으로 증류 → LiteRT int8 / CoreML / 웹 런타임. 판단 코어 패리티 테스트 | 중급 안드로이드 1장 150ms 이하, int8 정확도 하락 2%p 이내 |
| P4 위치 모델 | 1~2주 | GBIF 한국·중국·일본 관측 중 CC0/CC-BY만으로 위치 모델(SINR) 학습. 제주·해안 고도 해결 | 섬·해안을 바다로 보지 않음 |
| P5 통합·보정 | 2주 | 추론 백엔드 구현, 신뢰도 보정, 임계값·위치 가중치 재조정, 현장 시험 | 모르는 종 오답률 5% 이하 + 아는 종 정답률 목표 |
| P6 데이터 순환 | 상시 | 동의받은 관찰 사진 → 사람 검수 → 분기별 재학습 | 자체 데이터 비중 증가 |

이 앱은 이미 "동의 확인 · 사람 검수"를 거친 관찰만 기록집에 싣는다. P6에서 학습 데이터로 쓰려면 **학습 이용에 대한 별도 동의**가 필요하다. 출판 동의로 대신하지 않는다.

## 5. 먼저 짚을 위험
1. 데이터 권리가 무너지면 다른 단계도 무효가 된다. 라이선스 원장을 첫날부터 둔다.
2. BioCLIP 2를 교사로 쓰는 것 자체가 회색지대다. 막히면 옵션 B로 간다.
3. 같은 관찰자·장소의 사진이 학습과 시험에 섞이면 정확도가 부풀려진다.
4. 임계값 70은 새 모델에서 의미가 달라진다.

## 출처
- [iNaturalist 포럼: AWS Open Data로 상업 AI 학습 가능 여부](https://forum.inaturalist.org/t/can-i-use-inaturalist-aws-open-data-to-train-commercial-ai-model/77663)
- [iNaturalist Open Data on AWS](https://registry.opendata.aws/inaturalist-open-data)
- [inaturalist/model-files](https://github.com/inaturalist/model-files)
- [BioCLIP 2](https://huggingface.co/imageomics/bioclip-2) · [TreeOfLife-200M](https://huggingface.co/datasets/imageomics/TreeOfLife-200M)
- [SINR 논문](https://arxiv.org/abs/2306.02564)
- [AI허브 데이터셋 정보 (공공데이터포털)](https://www.data.go.kr/data/15135578/fileData.do?recommendDataYn=Y)
- [Downloading images from GBIF](https://journals.ku.edu/jbi/article/view/24326)
