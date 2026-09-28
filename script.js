/* ========================================
   기본 설정
======================================== */

const DAYS = [
  '월',
  '화',
  '수',
  '목',
  '금'
];


const COLORS = [
  '#dbeafe',
  '#dcfce7',
  '#fef3c7',
  '#fce7f3',
  '#ede9fe',
  '#cffafe',
  '#ffedd5',
  '#e0e7ff',
  '#fae8ff',
  '#d1fae5'
];


/* ========================================
   강의실 문자열 분석
======================================== */

const roomRe =
  /(.+?)-([A-Za-z]?\d+(?:-\d+)?)(?=\s+(?:.+?)-[A-Za-z]?\d+(?:-\d+)?(?:\s|$)|$)/g;


function roomsOf(s) {

  const rooms = [];

  roomRe.lastIndex = 0;

  let match;


  while (
    (
      match =
        roomRe.exec(
          String(s || '').trim()
        )
    )
  ) {

    const building =
      match[1].trim();

    const room =
      match[2].trim();


    rooms.push({

      building,

      room,

      full:
        `${building}-${room}`

    });

  }


  return rooms;
}


/* ========================================
   시간 문자열 분석
======================================== */

function timesOf(s) {

  const result = [];

  const re =
    /([월화수목금토일])\(([^)]*)\)/g;

  let match;


  while (
    (
      match =
        re.exec(
          String(s || '')
        )
    )
  ) {

    const ranges = [];


    for (
      const part
      of match[2].split(',')
    ) {

      const nums =
        part.match(/\d+/g);


      if (!nums) {
        continue;
      }


      let start =
        Number(nums[0]);

      let end =
        Number(
          nums[1] ??
          nums[0]
        );


      if (
        end < start
      ) {

        [
          start,
          end
        ] = [
          end,
          start
        ];

      }


      ranges.push({

        start,

        end,

        raw:
          part.trim()

      });

    }


    if (
      ranges.length
    ) {

      result.push({

        day:
          match[1],

        ranges

      });

    }

  }


  return result;
}


/* ========================================
   원본 데이터 변환
======================================== */

function expand(rows) {

  const result = [];


  for (
    const row
    of rows
  ) {

    const rooms =
      roomsOf(
        row.BLDG_COUM
      );


    const times =
      timesOf(
        row.LSTM_LIST
      );


    if (
      !rooms.length ||
      !times.length
    ) {

      continue;
    }


    times.forEach(
      (time, index) => {

        const targets =

          rooms.length ===
          times.length

            ? [
                rooms[index]
              ]

            : rooms;


        for (
          const room
          of targets
        ) {

          for (
            const range
            of time.ranges
          ) {

            result.push({

              ...room,

              day:
                time.day,

              start:
                range.start,

              end:
                range.end,

              subject:
                row.SUBJ_KNM ||
                row.SUBJ_CD_NM ||
                '과목명 없음',

              lect:
                row.LECT_NUMB ||
                '',

              prof:
                row.PROF_NM ||
                '',

              subj:
                row.SUBJ_CD ||
                ''

            });

          }

        }

      }
    );

  }


  /* 중복 제거 */

  const seen =
    new Set();


  return result.filter(
    item => {

      const key = [

        item.full,

        item.day,

        item.start,

        item.end,

        item.subject,

        item.lect,

        item.prof

      ].join('|');


      if (
        seen.has(key)
      ) {

        return false;
      }


      seen.add(key);

      return true;
    }
  );
}


/* ========================================
   데이터
======================================== */

const RAW =
  window.SEOULTECH_RAW || {
    semester: '',
    rows: []
  };


const S =
  expand(
    RAW.rows || []
  );


/* ========================================
   DOM
======================================== */

const bSel =
  document.querySelector('#building');

const rSel =
  document.querySelector('#room');

const tt =
  document.querySelector('#timetable');

const summary =
  document.querySelector('#summary');

const semesterText =
  document.querySelector('#semesterText');

const findFreeBtn =
  document.querySelector('#findFreeBtn');

const closeFreeBtn =
  document.querySelector('#closeFreeBtn');

const freePanel =
  document.querySelector('#freePanel');

const freeRooms =
  document.querySelector('#freeRooms');

const freeSummary =
  document.querySelector('#freeSummary');

const nowText =
  document.querySelector('#nowText');


/* ========================================
   학기 표시
======================================== */

function updateSemesterText() {

  const semester =
    String(
      RAW.semester || ''
    );


  const match =
    semester.match(
      /^(\d{4})([12])$/
    );


  if (
    !match
  ) {

    semesterText.textContent =
      '학기 정보';

    return;
  }


  const year =
    match[1];

  const term =
    match[2];


  semesterText.textContent =
    `${year}학년도 ${term}학기`;
}


/* ========================================
   시간표 왼쪽 시간 표시

   0교시  → 8
   1교시  → 9
   2교시  → 10
   3교시  → 11
   4교시  → 12
   5교시  → 1
   6교시  → 2
   ...
   14교시 → 10
======================================== */

function displayHour(period) {

  const hour24 =
    8 + period;


  return (
    (hour24 - 1) % 12
  ) + 1;
}


/* ========================================
   자연 정렬
======================================== */

const nat =
  (a, b) =>
    a.localeCompare(
      b,
      'ko',
      {
        numeric: true
      }
    );


/* ========================================
   건물 목록
======================================== */

function fillBuildings() {

  const buildings = [

    ...new Set(

      S.map(
        item =>
          item.building
      )

    )

  ].sort(nat);


  bSel.innerHTML =

    '<option value="" selected>건물을 선택하세요</option>'

    +

    buildings.map(
      building =>
        `<option value="${esc(building)}">${esc(building)}</option>`
    ).join('');


  fillRooms();
}


/* ========================================
   강의실 목록
======================================== */

function fillRooms() {

  if (
    !bSel.value
  ) {

    rSel.innerHTML =
      '<option value="" selected>강의실을 선택하세요</option>';


    rSel.disabled =
      true;


    render();

    return;
  }


  const rooms = [

    ...new Set(

      S
        .filter(
          item =>
            item.building ===
            bSel.value
        )
        .map(
          item =>
            item.room
        )

    )

  ].sort(nat);


  rSel.disabled =
    false;


  rSel.innerHTML =

    '<option value="" selected>강의실을 선택하세요</option>'

    +

    rooms.map(
      room =>
        `<option value="${esc(room)}">${esc(room)}</option>`
    ).join('');


  render();
}


/* ========================================
   과목 색상
======================================== */

function hash(s) {

  let h = 0;


  for (
    const c
    of s
  ) {

    h =
      (
        h * 31 +
        c.charCodeAt(0)
      ) >>> 0;

  }


  return h;
}


/* ========================================
   시간표 렌더링
======================================== */

function render() {

  tt.innerHTML =
    '';


  /* 왼쪽 위 빈 칸 */

  const blank =
    document.createElement(
      'div'
    );


  blank.className =
    'cell head';


  blank.style.gridColumn =
    1;


  blank.style.gridRow =
    1;


  tt.append(
    blank
  );


  /* 월 ~ 금 */

  DAYS.forEach(
    (day, index) => {

      const element =
        document.createElement(
          'div'
        );


      element.className =
        'cell head';


      element.textContent =
        day;


      element.style.gridColumn =
        index + 2;


      element.style.gridRow =
        1;


      tt.append(
        element
      );

    }
  );


  /*
     08:00 ~ 23:00

     왼쪽에는 교시가 아니라
     8, 9, 10, 11, 12, 1...
     만 표시
  */

  for (
    let period = 0;
    period <= 14;
    period++
  ) {

    const periodCell =
      document.createElement(
        'div'
      );


    periodCell.className =
      'cell period';


    periodCell.textContent =
      displayHour(
        period
      );


    periodCell.style.gridColumn =
      1;


    periodCell.style.gridRow =
      period + 2;


    tt.append(
      periodCell
    );


    /* 월 ~ 금 빈 셀 */

    for (
      let day = 0;
      day < DAYS.length;
      day++
    ) {

      const cell =
        document.createElement(
          'div'
        );


      cell.className =
        'cell';


      cell.style.gridColumn =
        day + 2;


      cell.style.gridRow =
        period + 2;


      tt.append(
        cell
      );

    }

  }


  /* 선택 전 */

  if (
    !bSel.value ||
    !rSel.value
  ) {

    summary.textContent =

      !bSel.value

        ? '건물을 선택하세요.'

        : '강의실을 선택하세요.';


    return;
  }


  /*
     선택된 강의실의
     월~금 수업
  */

  const list =
    S.filter(
      item =>

        item.building ===
          bSel.value

        &&

        item.room ===
          rSel.value

        &&

        DAYS.includes(
          item.day
        )
    );


  /* 수업 블록 */

  for (
    const item
    of list
  ) {

    const dayIndex =
      DAYS.indexOf(
        item.day
      );


    if (
      dayIndex < 0
    ) {

      continue;
    }


    const course =
      document.createElement(
        'div'
      );


    course.className =
      'course';


    course.style.background =

      COLORS[

        hash(
          item.subject +
          item.lect
        )

        %

        COLORS.length

      ];


    course.style.gridColumn =
      dayIndex + 2;


    course.style.gridRow =
      `${item.start + 2} / ${item.end + 3}`;


    course.innerHTML =

      esc(
        item.subject
      )

      +

      (
        item.lect

          ? `<small>${esc(item.lect)}분반</small>`

          : ''
      );


    tt.append(
      course
    );

  }


  summary.textContent =
    `${bSel.value} ${rSel.value} · 월~금 등록 수업 ${list.length}개`;
}


/* ========================================
   서울 현재 시간
======================================== */

function seoulNow() {

  const parts =
    new Intl.DateTimeFormat(
      'ko-KR',
      {
        timeZone:
          'Asia/Seoul',

        weekday:
          'short',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hourCycle:
          'h23'
      }
    ).formatToParts(
      new Date()
    );


  const get =
    type =>
      parts.find(
        item =>
          item.type === type
      )?.value || '';


  const weekday =
    get('weekday')
      .replace(
        '요일',
        ''
      );


  return {

    day:
      weekday.slice(0, 1),

    hour:
      Number(
        get('hour')
      ),

    minute:
      Number(
        get('minute')
      )

  };
}


/* ========================================
   현재 교시 계산

   08:00 = 0교시
   09:00 = 1교시
   ...
======================================== */

function currentPeriod(now) {

  const minutes =
    now.hour * 60 +
    now.minute;


  const start =
    8 * 60;


  if (
    minutes < start ||
    minutes >= 23 * 60
  ) {

    return null;
  }


  return Math.floor(
    (
      minutes -
      start
    )
    /
    60
  );
}


/* ========================================
   현재 시간 문구
======================================== */

function updateNowText() {

  const now =
    seoulNow();


  const period =
    currentPeriod(
      now
    );


  const hh =
    String(
      now.hour
    ).padStart(
      2,
      '0'
    );


  const mm =
    String(
      now.minute
    ).padStart(
      2,
      '0'
    );


  if (
    period === null
  ) {

    nowText.textContent =
      `서울시간 ${now.day}요일 ${hh}:${mm} · 현재 정규 수업 시간 밖입니다.`;

  } else {

    nowText.textContent =
      `서울시간 ${now.day}요일 ${hh}:${mm}`;

  }


  return {

    ...now,

    period

  };
}


/* ========================================
   모든 강의실
======================================== */

function allRooms() {

  const map =
    new Map();


  for (
    const item
    of S
  ) {

    if (
      !map.has(
        item.full
      )
    ) {

      map.set(
        item.full,
        {

          building:
            item.building,

          room:
            item.room,

          full:
            item.full

        }
      );

    }

  }


  return [
    ...map.values()
  ];
}


/* ========================================
   현재 빈 강의실 찾기
======================================== */

function showFreeRooms() {

  const now =
    updateNowText();


  freePanel.hidden =
    false;


  freeRooms.innerHTML =
    '';


  /* 주말 */

  if (
    !DAYS.includes(
      now.day
    )
  ) {

    freeSummary.textContent =
      '현재 서비스는 월요일부터 금요일까지의 강의실 시간표를 표시합니다.';


    freeRooms.innerHTML =
      '<div class="building-group">주말에는 평일 강의실 시간표를 제공하지 않습니다.</div>';


    return;
  }


  /* 현재 사용 중인 강의실 */

  const occupied =
    new Set(

      now.period === null

        ? []

        : S
            .filter(
              item =>

                item.day ===
                  now.day

                &&

                item.start <=
                  now.period

                &&

                item.end >=
                  now.period
            )
            .map(
              item =>
                item.full
            )

    );


  /* 빈 강의실 */

  let rooms =
    allRooms()
      .filter(
        room =>
          !occupied.has(
            room.full
          )
      );


  /* 선택된 건물이 있으면 필터 */

  if (
    bSel.value
  ) {

    rooms =
      rooms.filter(
        room =>
          room.building ===
          bSel.value
      );

  }


  rooms.sort(
    (a, b) =>

      nat(
        a.building,
        b.building
      )

      ||

      nat(
        a.room,
        b.room
      )
  );


  /* 건물별 그룹 */

  const groups =
    new Map();


  for (
    const room
    of rooms
  ) {

    if (
      !groups.has(
        room.building
      )
    ) {

      groups.set(
        room.building,
        []
      );

    }


    groups
      .get(
        room.building
      )
      .push(
        room
      );

  }


  /* 설명 */

  freeSummary.textContent =

    now.period === null

      ?

      `${bSel.value ? bSel.value + ' · ' : ''}정규 수업 시간 밖이라 등록된 강의실 ${rooms.length}개를 표시합니다.`

      :

      `${now.day}요일 ${displayHour(now.period)}시 · ${bSel.value ? bSel.value + ' · ' : ''}사용 가능 ${rooms.length}개`;


  /* 결과 생성 */

  for (
    const [
      building,
      list
    ]
    of groups
  ) {

    const box =
      document.createElement(
        'section'
      );


    box.className =
      'building-group';


    box.innerHTML =
      `
        <h3>
          ${esc(building)} · ${list.length}개
        </h3>

        <div class="room-chips"></div>
      `;


    const chips =
      box.querySelector(
        '.room-chips'
      );


    for (
      const room
      of list
    ) {

      const button =
        document.createElement(
          'button'
        );


      button.type =
        'button';


      button.className =
        'room-chip';


      button.textContent =
        room.room;


      button.addEventListener(
        'click',
        () =>
          selectRoom(
            room.building,
            room.room
          )
      );


      chips.append(
        button
      );

    }


    freeRooms.append(
      box
    );

  }


  if (
    !rooms.length
  ) {

    freeRooms.innerHTML =
      '<div class="building-group">현재 조건에서 사용 가능한 강의실이 없습니다.</div>';

  }


  freePanel.scrollIntoView({

    behavior:
      'smooth',

    block:
      'start'

  });
}


/* ========================================
   강의실 바로 선택
======================================== */

function selectRoom(
  building,
  room
) {

  bSel.value =
    building;


  fillRooms();


  rSel.value =
    room;


  render();


  freePanel.hidden =
    true;


  document
    .querySelector(
      '.controls'
    )
    .scrollIntoView({

      behavior:
        'smooth',

      block:
        'start'

    });
}


/* ========================================
   HTML 안전 처리
======================================== */

function esc(s) {

  return String(s)
    .replace(
      /[&<>"']/g,
      char => ({

        '&':
          '&amp;',

        '<':
          '&lt;',

        '>':
          '&gt;',

        '"':
          '&quot;',

        "'":
          '&#39;'

      }[char])
    );
}


/* ========================================
   이벤트
======================================== */

bSel.addEventListener(
  'change',
  () => {

    fillRooms();


    if (
      !freePanel.hidden
    ) {

      showFreeRooms();

    }

  }
);


rSel.addEventListener(
  'change',
  render
);


findFreeBtn.addEventListener(
  'click',
  showFreeRooms
);


closeFreeBtn.addEventListener(
  'click',
  () => {

    freePanel.hidden =
      true;

  }
);


/* ========================================
   시작
======================================== */

updateSemesterText();

fillBuildings();

updateNowText();


setInterval(
  updateNowText,
  60000
);
