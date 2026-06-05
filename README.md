# 지도를 훔친 자들: 세종시 게리맨더링 시뮬레이션

고등학교 일반사회 정치 수업용 웹 기반 시뮬레이션입니다. 학생은 세종특별자치시 읍·면·동을 묶어 선거구를 만들고, 같은 득표 분포라도 선거구 획정에 따라 의석 결과와 비례성이 어떻게 달라지는지 확인할 수 있습니다.

## 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 공유용 GitHub Pages

이 저장소를 GitHub에 올리고 GitHub Pages 배포를 켜면 `main` 브랜치에 push될 때 자동으로 빌드됩니다.

Firebase Realtime Database를 쓰려면 배포 환경에 다음 변수를 설정하세요.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
```
