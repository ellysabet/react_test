import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STORAGE_KEY = "deadline-command-plan-v3";
const FORM_KEY = "deadline-command-form-v3";
const COMPLETE_KEY = "deadline-command-complete-v3";

const emptyForm = {
  task: "",
  deadline: "",
  progress: "",
  availableHours: "2",
  timePreference: "상관없음",
  notes: "",
};

function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    list: <><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8"/><path d="M10 20h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13 7 4 4"/></>,
    rotate: <><path d="M20 6v5h-5"/><path d="M19 11a8 8 0 1 0 1 5"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const [screen, setScreen] = useState(() => readJson(STORAGE_KEY) ? "dashboard" : "form");
  const [form, setForm] = useState(() => ({ ...emptyForm, ...readJson(FORM_KEY) }));
  const [plan, setPlan] = useState(() => readJson(STORAGE_KEY));
  const [completed, setCompleted] = useState(() => readJson(COMPLETE_KEY) || {});
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [alarmItem, setAlarmItem] = useState(null);
  const [now, setNow] = useState(Date.now());
  const timers = useRef([]);

  useEffect(() => localStorage.setItem(FORM_KEY, JSON.stringify(form)), [form]);
  useEffect(() => { if (plan) localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); }, [plan]);
  useEffect(() => localStorage.setItem(COMPLETE_KEY, JSON.stringify(completed)), [completed]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (screen !== "loading") return;
    const id = setInterval(() => setLoadingStep((step) => Math.min(step + 1, 3)), 900);
    return () => clearInterval(id);
  }, [screen]);
  useEffect(() => {
    clearTimers();
    if (!plan?.schedule) return;
    plan.schedule.forEach((item, index) => {
      const delay = new Date(item.startAt).getTime() - Date.now();
      if (delay > 0 && delay < 2_147_000_000) timers.current.push(window.setTimeout(() => fireAlarm(item, index), delay));
    });
    return clearTimers;
  }, [plan]);

  function clearTimers() { timers.current.forEach(window.clearTimeout); timers.current = []; }
  function updateField(event) { setForm((prev) => ({ ...prev, [event.target.name]: event.target.value })); }
  function showToast(message) { setToast(message); window.setTimeout(() => setToast(""), 3500); }
  function fireAlarm(item, index) {
    if (completed[index]) return;
    setAlarmItem({ ...item, index });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("DEADLINE COMMAND", { body: `${item.title} — ${item.description}`, tag: `deadline-${index}`, requireInteraction: true });
    }
  }
  async function requestNotification() {
    if (!("Notification" in window)) return showToast("이 브라우저는 시스템 알림을 지원하지 않습니다.");
    const permission = await Notification.requestPermission();
    showToast(permission === "granted" ? "시스템 알림이 활성화되었습니다." : "알림 권한이 허용되지 않았습니다.");
  }
  async function generatePlan(event) {
    event.preventDefault();
    setError("");
    if (!form.task.trim() || !form.deadline) return setError("작업명과 최종 기한을 입력하세요.");
    if (new Date(form.deadline).getTime() <= Date.now()) return setError("최종 기한은 현재보다 이후여야 합니다.");
    setLoadingStep(0); setScreen("loading");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "계획 생성에 실패했습니다.");
      setPlan({ ...data, task: form.task, deadline: form.deadline, createdAt: new Date().toISOString() });
      setCompleted({}); setLoadingStep(3);
      window.setTimeout(() => setScreen("dashboard"), 450);
    } catch (err) { setError(err.message); setScreen("form"); }
  }
  function resetAll() {
    localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(COMPLETE_KEY);
    setPlan(null); setCompleted({}); setScreen("form");
  }
  function markDone(index) { setCompleted((prev) => ({ ...prev, [index]: !prev[index] })); }
  function snooze(item) {
    setAlarmItem(null);
    window.setTimeout(() => fireAlarm(item, item.index), 10 * 60 * 1000);
    showToast("10분 뒤 다시 알립니다.");
  }

  return (
    <div className="command-app">
      <Header onNotify={requestNotification} onHome={() => setScreen(plan ? "dashboard" : "form")} />
      <main className="main-stage">
        {screen === "form" && <InputScreen form={form} updateField={updateField} generatePlan={generatePlan} error={error} plan={plan} onBack={() => setScreen("dashboard")} now={now} />}
        {screen === "loading" && <LoadingScreen step={loadingStep} task={form.task} />}
        {screen === "dashboard" && plan && <Dashboard plan={plan} completed={completed} now={now} onNavigate={setScreen} onEdit={() => setScreen("form")} onReset={resetAll} onNotify={requestNotification} onDone={markDone} />}
        {screen === "timeline" && plan && <TimelineScreen plan={plan} completed={completed} now={now} onDone={markDone} onNavigate={setScreen} />}
        {screen === "tasks" && plan && <TaskScreen plan={plan} completed={completed} onDone={markDone} onNavigate={setScreen} />}
      </main>
      {plan && screen !== "form" && screen !== "loading" && <BottomNav screen={screen} onNavigate={setScreen} />}
      {toast && <div className="toast"><Icon name="bell"/><span>{toast}</span></div>}
      {alarmItem && <AlarmModal item={alarmItem} onDone={() => { markDone(alarmItem.index); setAlarmItem(null); }} onSnooze={() => snooze(alarmItem)} onDismiss={() => setAlarmItem(null)} />}
    </div>
  );
}

function Header({ onNotify, onHome }) {
  return <header className="command-header">
    <button className="wordmark" onClick={onHome}><span className="command-sigil">C</span><span>DEADLINE COMMAND</span></button>
    <div className="header-status"><span className="status-dot"/> SYSTEM ONLINE</div>
    <button className="icon-button" onClick={onNotify} aria-label="알림 켜기"><Icon name="bell"/></button>
  </header>;
}

function InputScreen({ form, updateField, generatePlan, error, plan, onBack, now }) {
  const remaining = form.deadline ? countdown(new Date(form.deadline).getTime() - now) : "--:--:--";
  return <section className="input-screen screen-enter">
    <div className="input-intro">
      <p className="kicker">NEW MISSION // AI SCHEDULING</p>
      <h1>마감을 입력하고<br/><span>실행 명령을 생성하세요.</span></h1>
      <p className="intro-copy">Gemini가 남은 시간을 분석해 구체적인 작업 순서, 시작 시각, 브라우저 알림을 설계합니다.</p>
      <div className="countdown-card"><small>TIME UNTIL DEADLINE</small><strong>{remaining}</strong><span>기한 입력 즉시 실시간 계산</span></div>
    </div>
    <form className="command-form" onSubmit={generatePlan}>
      <div className="form-head"><div><span>MISSION INPUT</span><h2>작업 정보</h2></div>{plan && <button type="button" className="text-button" onClick={onBack}>취소</button>}</div>
      <label><span>SUBJECT / 해야 할 일</span><textarea name="task" rows="3" value={form.task} onChange={updateField} placeholder="예: 고등부 AI 해커톤 8차시 교안 완성"/></label>
      <div className="split-fields">
        <label><span>FINAL DEADLINE</span><input type="datetime-local" name="deadline" value={form.deadline} onChange={updateField}/></label>
        <label><span>CURRENT STATUS</span><input name="progress" value={form.progress} onChange={updateField} placeholder="예: 목차 작성 완료"/></label>
      </div>
      <div className="split-fields">
        <label><span>DAILY FOCUS HOURS</span><select name="availableHours" value={form.availableHours} onChange={updateField}>{[1,2,3,4,5,6,8].map(h=><option key={h} value={h}>{h}시간</option>)}</select></label>
        <label><span>FOCUS WINDOW</span><select name="timePreference" value={form.timePreference} onChange={updateField}>{["상관없음","오전","오후","저녁","심야"].map(v=><option key={v}>{v}</option>)}</select></label>
      </div>
      <label><span>CONSTRAINTS / 추가 조건</span><input name="notes" value={form.notes} onChange={updateField} placeholder="예: 금요일 저녁 작업 불가, 검토 시간 2시간 필요"/></label>
      {error && <div className="form-error"><Icon name="alert"/>{error}</div>}
      <button className="generate-button" type="submit"><span><Icon name="bolt"/>GENERATE EXECUTION PLAN</span><Icon name="arrow"/></button>
      <p className="security-line"><Icon name="shield" size={15}/> API 키는 서버의 GEMINI_API_KEY 환경변수에서만 사용됩니다.</p>
    </form>
  </section>;
}

function LoadingScreen({ step, task }) {
  const steps = ["DEADLINE ANALYSIS", "TASK DECOMPOSITION", "TIME BLOCK ALLOCATION", "ALERT DEPLOYMENT"];
  return <section className="loading-screen screen-enter">
    <div className="radar"><div className="radar-line"/><div className="radar-core"><Icon name="bolt" size={34}/></div></div>
    <p className="kicker">GEMINI PLANNING ENGINE</p>
    <h1>EXECUTION PLAN<br/><span>GENERATING</span></h1>
    <p className="loading-subject">{task}</p>
    <div className="terminal-progress"><span style={{width:`${(step+1)*25}%`}}/></div>
    <div className="loading-list">{steps.map((label,index)=><div className={index<=step?"active":""} key={label}><b>{index<step?"✓":String(index+1).padStart(2,"0")}</b><span>{label}</span></div>)}</div>
  </section>;
}

function Dashboard({ plan, completed, now, onNavigate, onEdit, onReset, onNotify, onDone }) {
  const doneCount = Object.values(completed).filter(Boolean).length;
  const progress = Math.round((doneCount / plan.schedule.length) * 100);
  const next = plan.schedule.find((_,i)=>!completed[i]) || plan.schedule.at(-1);
  const remaining = countdown(new Date(next.startAt).getTime() - now);
  const deadlineLeft = countdown(new Date(plan.deadline).getTime() - now);
  return <section className="dashboard screen-enter">
    <div className="dashboard-top">
      <div><p className="kicker"><span className="status-dot"/> ACTIVE MISSION</p><h1>{plan.task}</h1></div>
      <div className="dashboard-actions"><button onClick={onEdit}><Icon name="edit"/>EDIT</button><button onClick={onReset}><Icon name="rotate"/>RESET</button></div>
    </div>
    <div className="metric-grid">
      <article className="metric critical"><small>FINAL DEADLINE</small><strong>{deadlineLeft}</strong><span>{formatDate(plan.deadline)}</span></article>
      <article className="metric"><small>MISSION PROGRESS</small><strong>{progress}%</strong><div className="mini-progress"><span style={{width:`${progress}%`}}/></div><span>{doneCount} / {plan.schedule.length} BLOCKS COMPLETE</span></article>
      <article className="metric"><small>DAILY TIMETABLE</small><strong>{plan.schedule.length}</strong><span>SCHEDULED BLOCKS</span></article>
    </div>
    <div className="dashboard-grid">
      <section className="next-command">
        <div className="section-label"><span>NEXT COMMAND</span><button onClick={()=>onNavigate("timeline")}>VIEW TIMELINE <Icon name="chevron" size={16}/></button></div>
        <div className="next-time">{remaining}</div>
        <small>UNTIL NEXT ACTION</small>
        <div className="next-task"><div><b>{formatTime(next.startAt)}</b><span>{formatDay(next.startAt)}</span></div><div><h2>{next.title}</h2><p>{next.description}</p></div></div>
        <div className="command-buttons"><button className="ack" onClick={()=>onDone(plan.schedule.indexOf(next))}><Icon name="check"/> MARK COMPLETE</button><button onClick={onNotify}><Icon name="bell"/> ENABLE ALERTS</button></div>
      </section>
      <aside className="checklist-panel">
        <div className="section-label"><span>EXECUTION CHECKLIST</span><button onClick={()=>onNavigate("tasks")}>ALL TASKS <Icon name="chevron" size={16}/></button></div>
        {plan.schedule.slice(0,5).map((item,index)=><button key={item.startAt} className={`quick-task ${completed[index]?"done":""}`} onClick={()=>onDone(index)}><span className="square-check">{completed[index]&&<Icon name="check" size={13}/>}</span><span><b>{item.title}</b><small>{formatTime(item.startAt)} · {formatDay(item.startAt)}</small></span></button>)}
      </aside>
    </div>
    <section className="strategy-strip"><div><small>AI EXECUTION STRATEGY</small><p>{plan.strategy}</p></div><div><small>IMMEDIATE ACTION</small><p>{plan.firstAction}</p></div></section>
  </section>;
}

function TimelineScreen({ plan, completed, now, onDone, onNavigate }) {
  return <section className="timeline-screen screen-enter">
    <PageTitle kicker="OPERATIONAL TIMELINE" title="타임테이블 상세" subtitle={formatDate(plan.deadline)} />
    <div className="timeline-toolbar"><button className="active">ALL BLOCKS</button><button onClick={()=>onNavigate("tasks")}>CHECKLIST VIEW</button></div>
    <div className="chronology">{plan.schedule.map((item,index)=>{
      const past = new Date(item.startAt).getTime() <= now;
      return <article className={`chronology-item ${completed[index]?"done":""} ${past&&!completed[index]?"current":""}`} key={item.startAt}>
        <div className="chronology-time"><strong>{formatTime(item.startAt)}</strong><span>{formatDay(item.startAt)}</span></div>
        <div className="chronology-line"><i/></div>
        <button className="chronology-card" onClick={()=>onDone(index)}><div><span className="priority-tag">{past&&!completed[index]?"CRITICAL":"SCHEDULED"}</span><h2>{item.title}</h2><p>{item.description}</p></div><span className="large-check">{completed[index]?<Icon name="check"/>:index+1}</span></button>
      </article>})}</div>
  </section>;
}

function TaskScreen({ plan, completed, onDone, onNavigate }) {
  const done = Object.values(completed).filter(Boolean).length;
  return <section className="task-screen screen-enter">
    <PageTitle kicker="MISSION CHECKLIST" title="할 일 목록" subtitle={`${done} / ${plan.schedule.length} 완료`} />
    <div className="task-summary"><strong>{Math.round(done/plan.schedule.length*100)}%</strong><div><span>MISSION COMPLETION</span><div className="mini-progress"><i style={{width:`${done/plan.schedule.length*100}%`}}/></div></div></div>
    <div className="task-list">{plan.schedule.map((item,index)=><button className={`task-row ${completed[index]?"done":""}`} key={item.startAt} onClick={()=>onDone(index)}><span className="square-check">{completed[index]&&<Icon name="check" size={14}/>}</span><span className="task-info"><b>{item.title}</b><small>{item.description}</small></span><span className="task-date">{formatTime(item.startAt)}<small>{formatDay(item.startAt)}</small></span></button>)}</div>
    <section className="risk-panel"><span>FAILURE PREVENTION</span><div>{plan.risks?.map(risk=><p key={risk}><Icon name="alert" size={16}/>{risk}</p>)}</div></section>
  </section>;
}

function PageTitle({ kicker, title, subtitle }) { return <div className="page-title"><p className="kicker">{kicker}</p><h1>{title}</h1><span>{subtitle}</span></div>; }
function BottomNav({ screen, onNavigate }) { const items=[["dashboard","grid","대시보드"],["timeline","calendar","타임테이블"],["tasks","list","할 일 목록"]]; return <nav className="bottom-nav">{items.map(([id,icon,label])=><button className={screen===id?"active":""} onClick={()=>onNavigate(id)} key={id}><Icon name={icon}/><span>{label}</span></button>)}</nav>; }
function AlarmModal({ item, onDone, onSnooze, onDismiss }) { return <div className="alarm-overlay"><section className="alarm-modal"><button className="alarm-close" onClick={onDismiss}><Icon name="x"/></button><p className="kicker"><span className="status-dot"/> URGENT PRIORITY</p><div className="alarm-code">DEADLINE BREACH</div><h1>TIME IS UP</h1><div className="alarm-subject"><small>SUBJECT</small><strong>{item.title}</strong><p>{item.description}</p></div><button className="alarm-complete" onClick={onDone}><Icon name="check"/> MARK AS COMPLETE</button><button className="alarm-snooze" onClick={onSnooze}><Icon name="clock"/> SNOOZE 10 MIN</button></section></div>; }

function readJson(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function formatDate(value) { return new Intl.DateTimeFormat("ko-KR", { month:"long", day:"numeric", weekday:"short", hour:"2-digit", minute:"2-digit" }).format(new Date(value)); }
function formatTime(value) { return new Intl.DateTimeFormat("ko-KR", { hour:"2-digit", minute:"2-digit", hour12:false }).format(new Date(value)); }
function formatDay(value) { return new Intl.DateTimeFormat("ko-KR", { month:"numeric", day:"numeric", weekday:"short" }).format(new Date(value)); }
function countdown(ms) { if (!Number.isFinite(ms)) return "--:--:--"; const sign=ms<0?"-":""; const total=Math.max(0,Math.floor(Math.abs(ms)/1000)); const d=Math.floor(total/86400); const h=Math.floor(total%86400/3600); const m=Math.floor(total%3600/60); const s=total%60; return `${sign}${d?`${String(d).padStart(2,"0")}:`:""}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }

createRoot(document.getElementById("root")).render(<App/>);
