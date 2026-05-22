# FRONT2LINE 제품별 매출 누적 BI

## 핵심 기능
- CSV/XLSX 여러 파일 동시 업로드
- 파일명 `2026년05월05일` 형식 날짜 인식
- Supabase DB에 날짜별/제품별 매출 누적 저장
- 동일 날짜 덮어쓰기 옵션
- A/B/C 기간 비교
- 제품명 합산 키워드 저장
- CSV 다운로드

## 배포 순서
1. Supabase 프로젝트 생성
2. Supabase SQL Editor에서 `supabase/schema.sql` 실행
3. Vercel 프로젝트 생성
4. Vercel Environment Variables에 아래 값 등록
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. GitHub 업로드 후 Vercel Deploy
