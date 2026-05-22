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


## 2026-05-22 수정
- Supabase 기본 1,000행 조회 제한으로 일부 날짜만 조회되던 문제 수정
- 기간 조회 및 저장 날짜 조회를 페이지네이션 방식으로 전체 행 조회하도록 개선


## Access Restriction
- 기본 비밀번호: `f2l1234567`
- Vercel Environment Variables에 `SITE_PASSWORD`를 추가하면 비밀번호를 변경할 수 있습니다.
- 비밀번호 입력 후 30일간 접속이 유지됩니다.


## 2026-05-22 Final Patch
- 비밀번호 잠금 화면 추가
- 합산 키워드 저장 시 기존 daily_product_sales 전체 재정규화
- 키워드 추가/삭제 후 기존 데이터 재업로드 없이 표에 반영 가능
- 기본 키워드에 `[앵콜반다]`, `[주말특가]`, `[팬츠야시장]` 추가


## Final Text Sync
- 상단 제목: 자사몰 제품별/기간별 매출 변화 트래킹
- 상단 안내문: made by 이혜원 이사 (문의 및 버그 제보 환영)
- 업로드 안내문 및 합산 키워드 안내문 캡처 기준 반영
- CSV 다운로드 수정 유지
- 비밀번호 잠금 유지
