/**
 * ============================================================
 * 우리 반 강점지도 - 학생용 기능 코드
 *
 * 일반 사용자는 이 파일을 수정하지 마세요.
 * 학교별 설정은 config.js에서만 수정하세요.
 * ============================================================
 */

// ===================== 전역 상태 =====================
const state = {
  classNo: null,
  number: null,
  code: null,
  name: null,
  roster: [],
  writtenTargets: [],
  currentTarget: null,

  selectedStrength1: null,
  selectedReason1: null,
  selectedStrength2: null,
  selectedReason2: null,

  pendingSaveData: null
};

// ===================== 화면 전환 =====================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(function (el) {
    el.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
}

function showLoading(text) {
  document.getElementById("loading-text").textContent = text || "처리 중...";
  document.getElementById("loading-overlay").classList.remove("hidden");
}
function hideLoading() {
  document.getElementById("loading-overlay").classList.add("hidden");
}

function showErrorModal(message, retryFn) {
  document.getElementById("error-modal-text").textContent = message;
  document.getElementById("error-modal").classList.remove("hidden");
  document.getElementById("btn-retry").classList.remove("hidden");
  state.pendingSaveData = retryFn || null;
}

function showAlreadyDoneModal() {
  document.getElementById("error-modal-text").textContent = "이미 작성한 친구입니다. 수정이 필요하면 선생님께 말하세요.";
  document.getElementById("error-modal").classList.remove("hidden");
  document.getElementById("btn-retry").classList.add("hidden");
  state.pendingSaveData = null;
}

function hideErrorModal() {
  document.getElementById("error-modal").classList.add("hidden");
  document.getElementById("btn-retry").classList.remove("hidden");
}

// ===================== HTML 안전 처리 =====================
function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===================== 금칙어 필터 =====================
function containsBannedWord(text) {
  if (!text) return false;
  return BANNED_WORDS.some(function (w) { return text.includes(w); });
}

// ===================== API 호출 =====================
function apiGet(params) {
  const query = new URLSearchParams(params).toString();
  return fetch(GAS_URL + "?" + query)
    .then(function (res) { return res.json(); });
}

function apiPost(body) {
  return fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  }).then(function (res) { return res.json(); });
}

// ===================== 화면 1: 로그인 =====================
function initLoginScreen() {
  const classSelect = document.getElementById("select-class");
  const numberSelect = document.getElementById("select-number");

  classSelect.innerHTML = '<option value="">반 선택</option>' +
    CLASS_LIST.map(function (c) { return '<option value="' + c + '">' + c + '반</option>'; }).join("");

  numberSelect.innerHTML = '<option value="">번호 선택</option>' +
    NUMBER_LIST.map(function (n) { return '<option value="' + n + '">' + n + '번</option>'; }).join("");

  document.getElementById("btn-login").addEventListener("click", handleLogin);
}

function handleLogin() {
  const classNo = document.getElementById("select-class").value;
  const number = document.getElementById("select-number").value;
  const code = document.getElementById("input-code").value.trim();
  const errorEl = document.getElementById("login-error");
  errorEl.classList.add("hidden");

  if (!classNo || !number || !code) {
    errorEl.textContent = "반, 번호, 개인 코드를 모두 입력해 주세요.";
    errorEl.classList.remove("hidden");
    return;
  }

  showLoading("확인 중...");
  apiGet({ action: "login", classNo: classNo, number: number, code: code })
    .then(function (res) {
      hideLoading();
      if (!res.ok) {
        errorEl.textContent = res.message || "로그인에 실패했습니다.";
        errorEl.classList.remove("hidden");
        return;
      }
      state.classNo = res.data.classNo;
      state.number = res.data.number;
      state.code = code;
      state.name = res.data.name;
      loadRosterAndProgress();
    })
    .catch(function () {
      hideLoading();
      errorEl.textContent = "서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.";
      errorEl.classList.remove("hidden");
    });
}

function loadRosterAndProgress() {
  showLoading("불러오는 중...");
  Promise.all([
    apiGet({ action: "getRoster", classNo: state.classNo, number: state.number, code: state.code }),
    apiGet({ action: "getProgress", classNo: state.classNo, number: state.number, code: state.code })
  ]).then(function (results) {
    hideLoading();
    const rosterRes = results[0];
    const progressRes = results[1];

    if (!rosterRes.ok || !progressRes.ok) {
      showErrorModal(rosterRes.message || progressRes.message || "데이터를 불러오지 못했습니다.", loadRosterAndProgress);
      return;
    }

    state.roster = rosterRes.data.filter(function (s) { return s.number !== state.number; });
    state.writtenTargets = progressRes.data.writtenTargets;

    if (progressRes.data.submitted) {
      showScreen("screen-done");
      return;
    }

    renderDashboard();
    showScreen("screen-dashboard");
  }).catch(function () {
    hideLoading();
    showErrorModal("네트워크 오류가 발생했습니다.", loadRosterAndProgress);
  });
}

// ===================== 화면 2: 대시보드 =====================
function renderDashboard() {
  document.getElementById("dash-class-number").textContent = state.classNo + "반 " + state.number + "번";
  document.getElementById("dash-name").textContent = state.name;

  const total = state.roster.length;
  const done = state.writtenTargets.length;

  document.getElementById("progress-current").textContent = done;
  document.getElementById("progress-total").textContent = total;
  document.getElementById("progress-fill").style.width = (total > 0 ? (done / total * 100) : 0) + "%";

  const grid = document.getElementById("friend-grid");
  grid.innerHTML = state.roster.map(function (friend) {
    const isDone = state.writtenTargets.includes(friend.number);
    return '<div class="friend-card ' + (isDone ? "done" : "") + '" data-number="' + escapeHTML(friend.number) + '" data-done="' + isDone + '">' +
      '<div class="f-number">' + escapeHTML(friend.number) + '번</div>' +
      '<div class="f-name">' + escapeHTML(friend.name) + '</div>' +
      '</div>';
  }).join("");

  grid.querySelectorAll(".friend-card").forEach(function (card) {
    card.addEventListener("click", function () {
      const isDone = card.getAttribute("data-done") === "true";
      const num = card.getAttribute("data-number");

      if (isDone) {
        showAlreadyDoneModal();
        return;
      }

      const friend = state.roster.find(function (f) { return f.number === num; });
      openWriteScreen(friend);
    });
  });

  const submitBtn = document.getElementById("btn-final-submit");
  submitBtn.disabled = !(done >= total && total > 0);
}

// ===================== 화면 3: 작성 화면 =====================
function openWriteScreen(friend) {
  state.currentTarget = friend;
  state.selectedStrength1 = null;
  state.selectedReason1 = null;
  state.selectedStrength2 = null;
  state.selectedReason2 = null;

  document.getElementById("write-target-number").textContent = friend.number + "번";
  document.getElementById("write-target-name").textContent = friend.name;

  renderStrengthOptions(1);
  renderReasonOptions(1);
  renderStrengthOptions(2);
  renderReasonOptions(2);

  ["other-strength1-input", "other-reason1-input", "other-strength2-input", "other-reason2-input", "message-input"]
    .forEach(function (id) { document.getElementById(id).value = ""; });

  document.getElementById("message-counter").textContent = "0자";
  
  ["other-strength1-wrap", "other-reason1-wrap", "other-strength2-wrap", "other-reason2-wrap"]
    .forEach(function (id) { document.getElementById(id).classList.add("hidden"); });

  document.getElementById("write-error").classList.add("hidden");

  showScreen("screen-write");
}

function renderStrengthOptions(n) {
  const wrap = document.getElementById("strength" + n + "-options");
  const allOptions = STRENGTH_LIST.concat(["기타 직접 입력"]);

  wrap.innerHTML = allOptions.map(function (s) {
    return '<button type="button" class="option-btn" data-value="' + escapeHTML(s) + '">' + escapeHTML(s) + '</button>';
  }).join("");

  wrap.querySelectorAll(".option-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectStrength(n, btn.getAttribute("data-value"), btn);
    });
  });
}

function selectStrength(n, value, btn) {
  const wrap = document.getElementById("strength" + n + "-options");
  const otherWrap = document.getElementById("other-strength" + n + "-wrap");
  const otherInput = document.getElementById("other-strength" + n + "-input");

  const currentValue = (n === 1) ? state.selectedStrength1 : state.selectedStrength2;

  if (currentValue === value) {
    if (n === 1) state.selectedStrength1 = null; else state.selectedStrength2 = null;
    btn.classList.remove("selected");
  } else {
    if (n === 1) state.selectedStrength1 = value; else state.selectedStrength2 = value;
    wrap.querySelectorAll(".option-btn").forEach(function (b) { b.classList.remove("selected"); });
    btn.classList.add("selected");
  }

  const selected = (n === 1) ? state.selectedStrength1 : state.selectedStrength2;
  if (selected === "기타 직접 입력") {
    otherWrap.classList.remove("hidden");
  } else {
    otherWrap.classList.add("hidden");
    otherInput.value = "";
  }
}

function renderReasonOptions(n) {
  const wrap = document.getElementById("reason" + n + "-options");
  const allOptions = REASON_LIST.concat(["기타 직접 입력"]);

  wrap.innerHTML = allOptions.map(function (r) {
    return '<button type="button" class="option-btn" data-value="' + escapeHTML(r) + '">' + escapeHTML(r) + '</button>';
  }).join("");

  wrap.querySelectorAll(".option-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectReason(n, btn.getAttribute("data-value"), btn);
    });
  });
}

function selectReason(n, value, btn) {
  const wrap = document.getElementById("reason" + n + "-options");
  const otherWrap = document.getElementById("other-reason" + n + "-wrap");
  const otherInput = document.getElementById("other-reason" + n + "-input");

  const currentValue = (n === 1) ? state.selectedReason1 : state.selectedReason2;

  if (currentValue === value) {
    if (n === 1) state.selectedReason1 = null; else state.selectedReason2 = null;
    btn.classList.remove("selected");
  } else {
    if (n === 1) state.selectedReason1 = value; else state.selectedReason2 = value;
    wrap.querySelectorAll(".option-btn").forEach(function (b) { b.classList.remove("selected"); });
    btn.classList.add("selected");
  }

  const selected = (n === 1) ? state.selectedReason1 : state.selectedReason2;
  if (selected === "기타 직접 입력") {
    otherWrap.classList.remove("hidden");
  } else {
    otherWrap.classList.add("hidden");
    otherInput.value = "";
  }
}

function initMessageCounter() {
  const input = document.getElementById("message-input");
  input.addEventListener("input", function () {
    document.getElementById("message-counter").textContent = input.value.length + "자";
  });
}

// ===================== 작성 내용 검증 + 저장 =====================
function validateAndBuildPayload() {
  const errorEl = document.getElementById("write-error");
  errorEl.classList.add("hidden");

  if (!state.selectedStrength1 || !state.selectedReason1) {
    return { error: "강점①과 그 이유를 모두 선택해 주세요." };
  }
  if (!state.selectedStrength2 || !state.selectedReason2) {
    return { error: "강점②와 그 이유를 모두 선택해 주세요." };
  }
  if (state.selectedStrength1 === state.selectedStrength2) {
    return { error: "강점①과 강점②는 서로 다른 것으로 선택해 주세요." };
  }

  let otherStrength1 = "";
  if (state.selectedStrength1 === "기타 직접 입력") {
    otherStrength1 = document.getElementById("other-strength1-input").value.trim();
    if (otherStrength1.length < LIMITS.otherStrengthMin) {
  return { error: "강점① 기타 입력은 1자 이상 입력해 주세요." };
}
    if (containsBannedWord(otherStrength1)) {
      return { error: "강점① 입력에 적절하지 않은 표현이 포함되어 있습니다." };
    }
  }

  let otherReason1 = "";
  if (state.selectedReason1 === "기타 직접 입력") {
    otherReason1 = document.getElementById("other-reason1-input").value.trim();
    if (otherReason1.length < LIMITS.otherReasonMin) {
  return { error: "강점① 이유 기타 입력은 1자 이상 입력해 주세요." };
}
    if (containsBannedWord(otherReason1)) {
      return { error: "강점① 이유 입력에 적절하지 않은 표현이 포함되어 있습니다." };
    }
  }

  let otherStrength2 = "";
  if (state.selectedStrength2 === "기타 직접 입력") {
    otherStrength2 = document.getElementById("other-strength2-input").value.trim();
    if (otherStrength2.length < LIMITS.otherStrengthMin) {
  return { error: "강점② 기타 입력은 1자 이상 입력해 주세요." };
}
    if (containsBannedWord(otherStrength2)) {
      return { error: "강점② 입력에 적절하지 않은 표현이 포함되어 있습니다." };
    }
  }

  let otherReason2 = "";
  if (state.selectedReason2 === "기타 직접 입력") {
    otherReason2 = document.getElementById("other-reason2-input").value.trim();
    if (otherReason2.length < LIMITS.otherReasonMin) {
  return { error: "강점② 이유 기타 입력은 1자 이상 입력해 주세요." };
}
    if (containsBannedWord(otherReason2)) {
      return { error: "강점② 이유 입력에 적절하지 않은 표현이 포함되어 있습니다." };
    }
  }

  // 한마디: 선택 사항 — 비어 있으면 검증 통과, 값이 있을 때만 길이/금칙어 검사
  const message = document.getElementById("message-input").value.trim();
if (message) {
  if (containsBannedWord(message)) {
    return { error: "한마디에 적절하지 않은 표현이 포함되어 있습니다." };
  }
}

  const payload = {
    action: "saveFeedback",
    classNo: state.classNo,
    number: state.number,
    code: state.code,
    targetNumber: state.currentTarget.number,
    strength1: state.selectedStrength1,
    reason1: state.selectedReason1,
    otherStrength1: otherStrength1,
    otherReason1: otherReason1,
    strength2: state.selectedStrength2,
    reason2: state.selectedReason2,
    otherStrength2: otherStrength2,
    otherReason2: otherReason2,
    message: message
  };

  return { payload: payload };
}

function saveFeedback(nextAction) {
  const result = validateAndBuildPayload();
  if (result.error) {
    const errorEl = document.getElementById("write-error");
    errorEl.textContent = result.error;
    errorEl.classList.remove("hidden");
    return;
  }

  showLoading("저장 중...");
  apiPost(result.payload)
    .then(function (res) {
      hideLoading();
      if (!res.ok) {
        showErrorModal(res.message || "저장에 실패했습니다.", function () { saveFeedback(nextAction); });
        return;
      }

      if (!state.writtenTargets.includes(state.currentTarget.number)) {
        state.writtenTargets.push(state.currentTarget.number);
      }

      if (nextAction === "next") {
        goToNextUnwrittenFriend();
      } else {
        renderDashboard();
        showScreen("screen-dashboard");
      }
    })
    .catch(function () {
      hideLoading();
      showErrorModal("네트워크 오류로 저장에 실패했습니다.", function () { saveFeedback(nextAction); });
    });
}

function goToNextUnwrittenFriend() {
  const next = state.roster.find(function (f) {
    return !state.writtenTargets.includes(f.number);
  });

  if (next) {
    openWriteScreen(next);
  } else {
    renderDashboard();
    showScreen("screen-dashboard");
  }
}

// ===================== 화면 4: 최종 제출 =====================
function handleFinalSubmitClick() {
  showScreen("screen-confirm");
}

function handleConfirmSubmit() {
  showLoading("제출 중...");
  apiPost({
    action: "finalSubmit",
    classNo: state.classNo,
    number: state.number,
    code: state.code
  }).then(function (res) {
    hideLoading();
    if (!res.ok) {
      showErrorModal(res.message || "제출에 실패했습니다.", handleConfirmSubmit);
      return;
    }
    showScreen("screen-done");
  }).catch(function () {
    hideLoading();
    showErrorModal("네트워크 오류로 제출에 실패했습니다.", handleConfirmSubmit);
  });
}

// ===================== 화면 6: 내 결과 =====================
function handleViewResultClick() {
  showLoading("결과를 불러오는 중...");
  apiGet({
    action: "getMyResult",
    classNo: state.classNo,
    number: state.number,
    code: state.code
  }).then(function (res) {
    hideLoading();

    if (!res.ok) {
      showErrorModal(res.message || "결과를 불러오지 못했습니다.", handleViewResultClick);
      return;
    }

    if (!res.data.generated) {
      document.getElementById("result-not-ready").classList.remove("hidden");
      document.getElementById("result-content").classList.add("hidden");
      showScreen("screen-result");
      return;
    }

    document.getElementById("result-not-ready").classList.add("hidden");
    document.getElementById("result-content").classList.remove("hidden");
    renderResult(res.data.result);
    showScreen("screen-result");
  }).catch(function () {
    hideLoading();
    showErrorModal("네트워크 오류로 결과를 불러오지 못했습니다.", handleViewResultClick);
  });
}

function renderResult(result) {
  document.getElementById("result-name").textContent = escapeHTML(result['이름']);

  const strengthItems = [
    { label: result['강점1위'], count: result['강점1위횟수'] },
    { label: result['강점2위'], count: result['강점2위횟수'] },
    { label: result['강점3위'], count: result['강점3위횟수'] }
  ];
  renderStrengthCards("result-strength-list", strengthItems);

  const reasonItems = [
    { label: result['주요이유1위'], count: result['주요이유1위횟수'] },
    { label: result['주요이유2위'], count: result['주요이유2위횟수'] },
    { label: result['주요이유3위'], count: result['주요이유3위횟수'] }
  ];
  renderReasonTags("result-reason-list", reasonItems);

  const otherStrength = String(result['기타강점모음'] || '').trim();
  if (otherStrength) {
    document.getElementById("result-other-strength-wrap").classList.remove("hidden");
    document.getElementById("result-other-strength").textContent = otherStrength;
  } else {
    document.getElementById("result-other-strength-wrap").classList.add("hidden");
  }

  const otherReason = String(result['기타이유모음'] || '').trim();
  if (otherReason) {
    document.getElementById("result-other-reason-wrap").classList.remove("hidden");
    document.getElementById("result-other-reason").textContent = otherReason;
  } else {
    document.getElementById("result-other-reason-wrap").classList.add("hidden");
  }

  renderFeedbacks(result['전체피드백모음']);
  renderMessages(result['한마디모음']);
}

// 강점 TOP3: "OO명의 친구가 추천했어요" 표현, 순위 강조 없이 동등하게
function renderStrengthCards(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items.map(function (item) {
    const label = String(item.label || '').trim();
    const count = Number(item.count) || 0;
    if (!label) return "";

    return '<div class="strength-card">' +
      '<span class="strength-name">' + escapeHTML(label) + '</span>' +
      '<span class="strength-count">' + count + '명의 친구가 추천했어요</span>' +
      '</div>';
  }).join("");
}

// 이유 TOP3: 둥근 태그 형태
function renderReasonTags(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items.map(function (item) {
    const label = String(item.label || '').trim();
    if (!label) return "";
    return '<span class="reason-tag">' + escapeHTML(label) + '</span>';
  }).join("");
}
function renderFeedbacks(feedbacksRaw) {
  const feedbacks = String(feedbacksRaw || '').trim();
  const wrap = document.getElementById("result-feedback-wrap");
  const listEl = document.getElementById("result-feedback-list");
  const moreBtn = document.getElementById("btn-feedback-more");

  if (!feedbacks) {
    wrap.classList.add("hidden");
    listEl.innerHTML = "";
    moreBtn.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");

  let list = [];
  if (feedbacks.indexOf("---FEEDBACK---") >= 0) {
    list = feedbacks.split("---FEEDBACK---").filter(function (m) {
      return m.trim();
    });
  } else {
    list = feedbacks.split("\n").filter(function (m) {
      return m.trim();
    });
  }

  const visibleCount = 5;
  const visibleList = list.slice(0, visibleCount);
  const hiddenList = list.slice(visibleCount);

  listEl.innerHTML = visibleList.map(function (m) {
    return '<div class="message-item">' +
      escapeHTML(m.trim()).replace(/\n/g, '<br>') +
      '</div>';
  }).join("");

  if (hiddenList.length > 0) {
    moreBtn.classList.remove("hidden");
    moreBtn.textContent = "더 보기 (" + hiddenList.length + ")";
    moreBtn.onclick = function () {
      listEl.innerHTML += hiddenList.map(function (m) {
        return '<div class="message-item">' +
          escapeHTML(m.trim()).replace(/\n/g, '<br>') +
          '</div>';
      }).join("");
      moreBtn.classList.add("hidden");
    };
  } else {
    moreBtn.classList.add("hidden");
  }
}

function renderMessages(messagesRaw) {
  const messages = String(messagesRaw || '').trim();
  const wrap = document.getElementById("result-message-wrap");
  const listEl = document.getElementById("result-message-list");
  const moreBtn = document.getElementById("btn-message-more");

  if (!messages) {
    wrap.classList.add("hidden");
    listEl.innerHTML = "";
    moreBtn.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");

  const list = messages.split("\n").filter(function (m) {
    return m.trim();
  });

  const visibleCount = 5;
  const visibleList = list.slice(0, visibleCount);
  const hiddenList = list.slice(visibleCount);

  listEl.innerHTML = visibleList.map(function (m) {
    return '<div class="message-item">' + escapeHTML(m.trim()) + '</div>';
  }).join("");

  if (hiddenList.length > 0) {
    moreBtn.classList.remove("hidden");
    moreBtn.textContent = "더 보기 (" + hiddenList.length + ")";
    moreBtn.onclick = function () {
      listEl.innerHTML += hiddenList.map(function (m) {
        return '<div class="message-item">' + escapeHTML(m.trim()) + '</div>';
      }).join("");
      moreBtn.classList.add("hidden");
    };
  } else {
    moreBtn.classList.add("hidden");
  }
}
// ===================== 이벤트 바인딩 =====================
function bindEvents() {
  document.getElementById("btn-back-dashboard").addEventListener("click", function () {
    renderDashboard();
    showScreen("screen-dashboard");
  });

  document.getElementById("btn-save-next").addEventListener("click", function () {
    saveFeedback("next");
  });

  document.getElementById("btn-save-dashboard").addEventListener("click", function () {
    saveFeedback("dashboard");
  });

  document.getElementById("btn-final-submit").addEventListener("click", handleFinalSubmitClick);
  document.getElementById("btn-confirm-submit").addEventListener("click", handleConfirmSubmit);
  document.getElementById("btn-cancel-submit").addEventListener("click", function () {
    showScreen("screen-dashboard");
  });

  document.getElementById("btn-view-result").addEventListener("click", handleViewResultClick);

  document.getElementById("btn-result-back-done").addEventListener("click", function () {
    showScreen("screen-done");
  });
  document.getElementById("btn-result-back-done2").addEventListener("click", function () {
    showScreen("screen-done");
  });

  document.getElementById("btn-retry").addEventListener("click", function () {
    hideErrorModal();
    if (typeof state.pendingSaveData === "function") {
      state.pendingSaveData();
    }
  });

  document.getElementById("btn-error-close").addEventListener("click", hideErrorModal);
}

// ===================== 초기화 =====================
document.addEventListener("DOMContentLoaded", function () {
  const titleEl = document.getElementById("program-title");
  const schoolEl = document.getElementById("school-name");

  if (titleEl && typeof PROGRAM_TITLE !== "undefined") {
    titleEl.textContent = PROGRAM_TITLE;
  }
  if (schoolEl && typeof SCHOOL_NAME !== "undefined") {
    schoolEl.textContent = SCHOOL_NAME;
  }

  initLoginScreen();
  initMessageCounter();
  bindEvents();
});
