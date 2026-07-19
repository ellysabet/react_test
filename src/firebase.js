// Firebase Console > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성에서
// firebaseConfig 값을 아래 객체에 그대로 붙여 넣으세요.
// 서비스 계정 키는 사용하지 않습니다.
const firebaseConfig = {
  apiKey: "AIzaSyB0nj8JLOBn-_YMghgkDZlP7x-BywOO4sk",
  authDomain: "reacttest-844b0.firebaseapp.com",
  projectId: "reacttest-844b0",
  storageBucket: "reacttest-844b0.firebasestorage.app",
  messagingSenderId: "536611151441",
  appId: "1:536611151441:web:49bc7c54874f8cb9bc2270"
};

const COLLECTION_NAME = "feedback";

function assertConfigured() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE_")) {
    throw new Error("src/firebase.js에 Firebase 웹 설정값(firebaseConfig)을 입력해 주세요.");
  }
  if (!firebaseConfig.projectId || firebaseConfig.projectId.startsWith("PASTE_")) {
    throw new Error("Firebase projectId 설정을 확인해 주세요.");
  }
}

function baseUrl() {
  assertConfigured();
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
}

export async function addFeedback({ author, content }) {
  const response = await fetch(`${baseUrl()}/${COLLECTION_NAME}?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        author: { stringValue: author },
        content: { stringValue: content },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!response.ok) throw new Error(await firebaseError(response, "의견 등록에 실패했습니다."));
}

export async function loadFeedback() {
  const response = await fetch(`${baseUrl()}:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: COLLECTION_NAME }],
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
        limit: 100,
      },
    }),
  });
  if (!response.ok) throw new Error(await firebaseError(response, "게시글을 불러오지 못했습니다."));
  const rows = await response.json();
  return rows
    .filter((row) => row.document)
    .map(({ document }) => ({
      id: document.name.split("/").pop(),
      author: document.fields?.author?.stringValue || "익명",
      content: document.fields?.content?.stringValue || "",
      createdAt: document.fields?.createdAt?.timestampValue || null,
    }));
}

async function firebaseError(response, fallback) {
  try {
    const data = await response.json();
    if (data?.error?.message?.includes("PERMISSION_DENIED")) {
      return "Firestore 보안 규칙에서 feedback 컬렉션의 읽기와 생성 권한을 확인해 주세요.";
    }
    return data?.error?.message || fallback;
  } catch {
    return fallback;
  }
}
