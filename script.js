// Firebase Realtime Database 참조
const database = firebase.database();
const sharedStateRef = database.ref('intonation_sync_room'); // 데이터베이스의 '방' 이름

// DOM 요소 정의
const practiceAudio = document.getElementById('practiceAudio');
const playButton = document.getElementById('playAudio');
const syncStatus = document.getElementById('syncStatus');

// 스크롤 동기화 변수
let isSyncingScroll = false;
const THROTTLE_TIME = 100; // 100ms마다 스크롤 위치 전송 (잦은 DB 쓰기 방지)

// --- 1. 스크롤 위치 동기화 ---

// 현재 사용자의 스크롤 변경 시 Firebase에 기록 (전송)
window.addEventListener('scroll', function() {
    if (isSyncingScroll) return; // 수신된 스크롤 명령은 무시

    // 지정된 간격으로만 전송
    if (Date.now() % THROTTLE_TIME === 0) {
        sharedStateRef.child('scrollPosition').set(window.scrollY);
    }
});

// Firebase 데이터 변경 감지 및 스크롤 위치 반영 (수신)
sharedStateRef.child('scrollPosition').on('value', (snapshot) => {
    const newPosition = snapshot.val();
    
    if (newPosition !== null && Math.abs(window.scrollY - newPosition) > 10) {
        // 현재 위치와 10px 이상 차이 날 때만 동기화
        isSyncingScroll = true; // 스크롤 이벤트 루프 방지 플래그
        
        window.scrollTo({
            top: newPosition,
            behavior: 'auto' // 부드러운 스크롤 효과 없이 즉시 이동
        });
        
        // 잠시 후 플래그 해제
        setTimeout(() => { isSyncingScroll = false; }, 200); 

        syncStatus.textContent = '스크롤 동기화 완료';
    } else {
        syncStatus.textContent = '연결됨 (대기 중)';
    }
}, (error) => {
    syncStatus.textContent = '연결 오류: ' + error.message;
    console.error(error);
});


// --- 2. 오디오 재생 동기화 ---

// 버튼 클릭 시 Firebase에 명령 전송
playButton.addEventListener('click', function() {
    // 재생 명령과 함께 현재 서버 시간을 기록하여 최신 명령임을 확인
    const command = {
        action: 'play',
        timestamp: firebase.database.ServerValue.TIMESTAMP, // Firebase 서버 시간 사용
        clipId: 'practiceAudio' // 오디오 요소 ID
    };
    sharedStateRef.child('audioCommand').set(command);
});

// Firebase 명령 감지 및 오디오 재생 (수신)
let lastTimestamp = 0;
sharedStateRef.child('audioCommand').on('value', (snapshot) => {
    const command = snapshot.val();

    if (command && command.action === 'play' && command.clipId === 'practiceAudio') {
        // 중복 및 과거 명령 방지
        if (command.timestamp > lastTimestamp) {
            lastTimestamp = command.timestamp;

            // 오디오 재생
            practiceAudio.pause();
            practiceAudio.currentTime = 0; // 항상 처음부터 재생
            practiceAudio.play()
                .then(() => {
                    console.log(`오디오 재생 명령 수신 및 실행: ${command.timestamp}`);
                })
                .catch(error => {
                    // 브라우저 정책(Chrome 등)으로 인해 자동 재생이 차단될 수 있습니다.
                    console.warn("오디오 자동 재생 실패:", error);
                    alert("⚠️ 자동 재생 차단: 브라우저 정책으로 인해 재생이 안 될 수 있습니다. 페이지를 클릭/터치한 후 다시 시도해 보세요.");
                });
        }
    }
});