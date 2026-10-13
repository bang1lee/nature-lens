# Nature Lens · Seek 온디바이스 판별 조사 (2026-10-13)

확인 시각: 2026-10-13 KST. 상태: **조사·설계 제안. 앱 코드 변경 없음, 구현 승인 전.**

카메라로 자연물을 알아보는 흐름의 레퍼런스로 [inaturalist/SeekReactNative](https://github.com/inaturalist/SeekReactNative)(MIT)의 온디바이스 판별 구조를 리버스 엔지니어링하고, 그 결과를 Nature Lens에 적용할 때의 판단 로직, 평가 방법, 학습 로드맵, 데이터 권리를 정리했다. [mvp-20261007/GITHUB-REFERENCES.md](../mvp-20261007/GITHUB-REFERENCES.md)가 Seek의 화면 흐름을 참고했다면, 이 문서는 **판별 엔진**을 다룬다.

## 문서
| 문서 | 내용 |
|---|---|
| [SEEK-ONDEVICE-TEARDOWN.md](SEEK-ONDEVICE-TEARDOWN.md) | Seek 판별 파이프라인, 근거, 실측, 함정, 리버스 엔지니어링 도구(REA) 평가 |
| [ONDEVICE-DECISION-CORE.md](ONDEVICE-DECISION-CORE.md) | TypeScript 판단 코어 한 벌과 이 앱의 식별 흐름에 넣는 방법 (제안) |
| [FINETUNE-ROADMAP.md](FINETUNE-ROADMAP.md) | 한국 종 평가 방법, 모델·데이터 라이선스, 학습 로드맵 P0~P6 |

## 수행한 것
- Seek 소스에서 Android JS 번들을 직접 빌드해 블랙박스 분석하고, 공개 모델 파일(TFLite)의 입출력 구조를 파싱했다. 결론은 공개 네이티브 소스와 대조했다.
- 판별 알고리즘을 Python으로 다시 구현하고 실제 모델로 테스트했다. TypeScript로도 옮겨 Python 결과와 52케이스 패리티를 맞췄다.
- 코드, 증거, 테스트는 [bang1lee/claude-workspace PR #3](https://github.com/bang1lee/claude-workspace/pull/3)의 `reverse-engineering/naturelens-seek/`에 있다.

## 수행하지 않은 것
- 이 저장소의 앱 코드, 의존성, 설정은 바꾸지 않았다. 온디바이스 판별은 현재 앱 기능이 아니다.
- 스토어 배포 APK는 분석하지 않았다(네트워크 정책으로 내려받지 못함). 소스에서 빌드한 번들 기준이다.
- 한국 종 사진으로 정확도를 재지 않았다. 평가 도구만 만들었고, 실측은 사진 2장의 동작 확인뿐이다.
- 법률 검토는 하지 않았다. 라이선스 항목은 공개 문서를 읽은 결과다.

## 분석 대상 고정 커밋
| 저장소 | 커밋 · 커밋 날짜 | 라이선스 |
|---|---|---|
| [inaturalist/SeekReactNative](https://github.com/inaturalist/SeekReactNative) | [a4e5507fe030](https://github.com/inaturalist/SeekReactNative/commit/a4e5507fe03013921dc243af2e01f875da567956) · 2026-10-08 | MIT |
| [inaturalist/vision-camera-plugin-inatvision](https://github.com/inaturalist/vision-camera-plugin-inatvision) (`version-7`) | [e2f6aacac1d0](https://github.com/inaturalist/vision-camera-plugin-inatvision/commit/e2f6aacac1d05ae0abbb52d092d8eeb0812b8b39) · 2026-09-06 | MIT |
| [inaturalist/model-files](https://github.com/inaturalist/model-files) (릴리스 v25.01.15 자산) | [7cfde5d8b5fe](https://github.com/inaturalist/model-files/commit/7cfde5d8b5fef1624decae4c97a32495adc5b179) · 2025-03-20 | MIT |

PRD 진본과 전략 판단은 뉴리프 위키에서 관리한다. 같은 내용의 위키 노트는 `NatureLens/Seek 레퍼런스 2026-10-13/`에 있다.
