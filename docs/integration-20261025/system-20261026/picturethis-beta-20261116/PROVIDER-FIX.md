# 식별 공급자 오류 수정 · 2026-11-16

## 문제와 근거

기존 배포의 CC0 민들레 사진 식별 요청은 앱 게이트웨이에서 HTTP 200과 `not_plant`를 반환했다. 이는 공급자 원본 응답이 아니었다. 같은 사진에 앱의 브라우저 이미지 인코딩 두 차례와 서버의 JPEG 정제를 적용한 뒤 기존 공급자 요청을 직접 재현했다. 공급자 직접 호출 첫 번째 결과는 다음과 같았다. 비밀 정보는 포함하지 않았다.

```json
{
  "http": 404,
  "contentType": "application/json; charset=utf-8",
  "body": {
    "statusCode": 404,
    "error": "Not Found",
    "message": "No localization available for ko"
  }
}
```

요청의 `lang=ko`가 지원되지 않았는데 기존 코드는 모든 HTTP 404를 `not_plant`로 변환했다. 공급자 오류를 사진 판정으로 잘못 표시한 것이 관찰된 실패의 원인이다.

Pl@ntNet [단일 식별 공식 문서](https://my.plantnet.org/doc/api/identify)는 언어 코드를 지원 목록에서 선택하도록 하고, 404의 `Species not found`는 비식물 거부뿐 아니라 후보를 찾지 못한 경우에도 쓰인다고 설명한다. 따라서 404만으로 비식물이라 단정할 수 없다.

## 수정과 실제 공급자 재검사

지원되지 않는 언어 옵션을 제거하고 기본 언어를 사용한다. 제공된 한국어 이름이 있으면 우선하고, 없으면 공급자의 일반 이름을 표시 이름으로 사용한다. 공급자·모델·`all` 프로젝트·`no-reject=false` 설정은 바꾸지 않았다. 문서상 `Species not found`만 불확실한 결과로 처리하며, 언어 오류 등 다른 404는 공급자 연결 오류로 처리한다. 실제 `Species not found` 응답 본문의 상세 형식은 이번 검사에서 관찰하지 못했으며, 알 수 없는 형식은 오류로 처리한다.

수정된 로컬 공급자 어댑터로 동일 사진을 직접 호출한 두 번째이자 마지막 결과:

```json
{
  "http": 200,
  "state": "candidates",
  "provider": "plantnet",
  "modelVersion": "2026-03-20 (7.5)",
  "candidates": [
    {
      "scientificName": "Taraxacum sect. Taraxacum",
      "commonName": "Common dandelion",
      "score": 0.21307
    }
  ],
  "needsHumanReview": true
}
```

점수는 보정된 정답 확률이 아니다. 후보가 반환된 사실만 확인했으며, 생물종의 정답·한국어 이름·현장 관찰로 확정하지 않았다. 이 결과는 수정된 로컬 어댑터의 실제 공급자 응답이며, 수정된 서버의 원격 배포 또는 공개 앱 전체 흐름 검증은 아니다.

## 범위와 검사

- 사진: [LorelMan의 CC0 민들레 사진](https://commons.wikimedia.org/wiki/File:Dandelion_flower_photo.jpg). 청량산 현장 관찰이나 평가 사진이 아니다.
- 이번 원인 조사에서 직접 공급자 호출 2회. 위 최초 게이트웨이 요청은 별도 이전 검사다.
- 관련 단위검사 20개, 타입 검사와 `verify:local` 통과. HTTP 404 오류와 불확실한 식별의 분리, 이름 표시 fallback을 모의 응답으로 검사했다.
- 공급자 키·인증 토큰·사진 원본을 이 문서에 기록하지 않았다.
