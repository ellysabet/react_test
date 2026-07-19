# DEADLINE COMMAND — React + Gemini

Google Stitch의 **Chronos Alert System** 디자인을 기존 React 마감 알람 앱에 적용한 버전입니다.

## 유지된 핵심 구조
- Gemini API 호출: `api/generate.js`
- API 키: `process.env.GEMINI_API_KEY`
- React + Vite 프론트엔드
- Vercel 서버리스 배포
- 작업/기한 입력, AI 계획 생성, 생성 진행 화면, 타임테이블, 브라우저 알림, 완료 체크, 진행률, LocalStorage 저장

## Vercel 배포
1. 이 폴더 전체를 GitHub 저장소에 업로드합니다.
2. Vercel에서 저장소를 Import합니다.
3. Settings → Environment Variables에서 `GEMINI_API_KEY`를 등록합니다.
4. Deploy 또는 Redeploy합니다.

## 로컬 실행(선택)
```bash
npm install
npm run dev
```
서버리스 함수까지 테스트하려면 `vercel dev`를 사용합니다.
