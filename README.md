# Deadline Alarm — Stitch React

## Vercel 배포
1. 이 폴더의 파일을 GitHub 저장소 루트에 업로드합니다.
2. Vercel에서 저장소를 Import합니다.
3. Settings > Environment Variables에 `GEMINI_API_KEY`를 등록합니다.
4. Deploy 또는 Redeploy를 실행합니다.

## 중요
- Gemini API 호출: `api/generate.js`
- API 키: `process.env.GEMINI_API_KEY`
- Node.js: 20.x
- npm은 공개 레지스트리를 사용하도록 `.npmrc`에 지정되어 있습니다.

## Firebase 사용자 의견 게시판 설정

1. Firebase Console에서 웹 앱을 등록합니다.
2. Firestore Database를 생성합니다.
3. `src/firebase.js`의 `firebaseConfig` 객체를 Firebase에서 제공한 웹 설정값으로 교체합니다.
4. 서비스 계정 키는 사용하지 않습니다.
5. Firestore 컬렉션 이름은 `feedback`이며 글은 `createdAt` 기준 최신순으로 표시됩니다.

개발 단계에서 사용할 수 있는 Firestore 규칙 예시:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /feedback/{document} {
      allow read: if true;
      allow create: if request.resource.data.keys().hasOnly(['author', 'content', 'createdAt'])
                    && request.resource.data.author is string
                    && request.resource.data.author.size() <= 30
                    && request.resource.data.content is string
                    && request.resource.data.content.size() > 0
                    && request.resource.data.content.size() <= 1000;
      allow update, delete: if false;
    }
  }
}
```
