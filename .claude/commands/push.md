모든 변경 사항을 git add, 한국어 커밋 메시지 작성, push를 수행합니다.

1. `git status`로 변경 사항 확인
2. `git diff --staged`와 `git diff`로 변경 내용 분석
3. `git log --oneline -5`로 최근 커밋 메시지 스타일 확인
4. 변경 내용을 분석하여 한국어 커밋 메시지를 작성 (예: "feat: 프로젝트 기본 폰트 설정 기능 추가")
   - 커밋 메시지 형식: `<type>: <한국어 설명>`
   - type: feat, fix, refactor, docs, chore, style, test 등
5. `git add -A`로 모든 변경 사항 스테이징
6. 한국어 커밋 메시지로 커밋 생성
7. 현재 브랜치를 원격에 push
