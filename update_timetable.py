import json, os, sys, time
from datetime import datetime, timezone, timedelta
from pathlib import Path
import requests

KST = timezone(timedelta(hours=9))
now_kst = datetime.now(KST)
# 학기 자동 선택: 3~8월은 1학기, 9~12월은 2학기, 1~2월은 전년도 2학기
if now_kst.month >= 9:
    SEMESTER = f"{now_kst.year}2"
elif now_kst.month >= 3:
    SEMESTER = f"{now_kst.year}1"
else:
    SEMESTER = f"{now_kst.year - 1}2"
BASE = "https://for-s.seoultech.ac.kr"
PAGE = BASE + "/html/pub/schedule.jsp"
API = BASE + "/JSONMain"
DEPARTMENTS = ['20030105', '20030111', '20030309', '20030301', '20030305', '300037', '300036', 'C581564', 'C581781', '20031201', '20030505', 'C581682', 'C581681', '20030701', '20030703', '20030705', '20030707', '20031110', '20031111', 'C581774', '300014', '300013', '20030905', '20030907', '20030909', '20031103', '20031105', '20031107', 'C581754', '20031404', '20033003', '20031403', '20033004', '20033002', '20031405', 'C581488', 'C581461', '20031500', '20031501', '20031503', '20031502', '20031504', '20031505', '20031506', 'C581766', 'C581700', 'C581755', 'C581652', 'C581651', '300015', '20050109', 'C581659', 'C581671', 'C581751', 'C581779', 'C581778', 'C581777', '300029']
ROOT = Path(__file__).resolve().parent

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; SeoulTechTimetableUpdater/1.0)",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/json;charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": PAGE,
})

# Establish the same public session/cookies used by the timetable page.
session.get(PAGE, timeout=30).raise_for_status()

rows = []
failures = []
for i, less_cd in enumerate(DEPARTMENTS, 1):
    payload = {
        "fsp_action": "GridAction",
        "fsp_cmd": "getScheduleGridData",
        "SP_YMST": SEMESTER,
        "LESS_CD": less_cd,
        "DN_DIV": "00500001",
        "SUBJ_NM": "",
        "LECT_DIV": "",
        "DOTW_CD": ""
    }
    last_error = None
    for attempt in range(3):
        try:
            res = session.post(API, json=payload, timeout=45)
            res.raise_for_status()
            data = res.json()
            if str(data.get("ErrorCode", "0")) not in ("0", ""):
                raise RuntimeError(data.get("ErrorMsg") or f"ErrorCode={data.get('ErrorCode')}")
            got = data.get("rows") or []
            for row in got:
                row = dict(row)
                row["_source_less_cd"] = less_cd
                rows.append(row)
            last_error = None
            break
        except Exception as e:
            last_error = str(e)
            time.sleep(2 * (attempt + 1))
    if last_error:
        failures.append({"LESS_CD": less_cd, "error": last_error})

# Never replace a good public dataset with a clearly partial/failed scrape.
if failures:
    print(json.dumps({"failures": failures}, ensure_ascii=False, indent=2), file=sys.stderr)
    raise SystemExit("One or more department requests failed; existing site data was left unchanged.")
if len(rows) < 1000:
    raise SystemExit(f"Safety check failed: only {len(rows)} rows returned.")

# Remove duplicate raw records caused by overlapping source queries, while retaining
# the source marker for traceability. Site-side code also deduplicates occupancy events.
raw_doc = {"semester": SEMESTER, "rows": rows}
raw_text = json.dumps(raw_doc, ensure_ascii=False, indent=2) + "\n"
(ROOT / f"seoultech_RAW_{SEMESTER}.json").write_text(raw_text, encoding="utf-8")
(ROOT / "data.js").write_text(
    "window.SEOULTECH_RAW = " + json.dumps(raw_doc, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8"
)
print(f"Updated {len(rows)} raw timetable rows from {len(DEPARTMENTS)} department codes.")
