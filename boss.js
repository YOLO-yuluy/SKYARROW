/* ============================================================
   凌箭航天 SKYARROW — 博主发射台 boss.js（boss.html 专用）
   与用户端 index.html 通过 localStorage + BroadcastChannel 联动
   注意：仅在同一 origin（同一台电脑、同一浏览器）内互通
   ============================================================ */
(function () {
    "use strict";

    function $(sel, root) { return (root || document).querySelector(sel); }

    var store = {
        get: function (k, def) {
            try { var v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); }
            catch (e) { return def; }
        },
        set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };

    /* ---- toast ---- */
    var toastEl = $("#toast"), toastTimer = null;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
    }

    /* ---- 音效（WebAudio 合成） ---- */
    var actx = null;
    function beep(freq, dur, type, vol) {
        try {
            if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
            var o = actx.createOscillator();
            var g = actx.createGain();
            o.type = type || "sine";
            o.frequency.value = freq;
            g.gain.value = vol || 0.05;
            o.connect(g); g.connect(actx.destination);
            var t = actx.currentTime;
            g.gain.setValueAtTime(g.gain.value, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.start(t); o.stop(t + dur);
        } catch (e) {}
    }

    /* ---- 票据数据（与用户端共用同一 localStorage 键） ---- */
    var lpTicketKey = "skyarrow_launch_tickets";
    function lpGetTickets() { return store.get(lpTicketKey, []); }
    function lpSetTickets(t) { store.set(lpTicketKey, t.slice(0, 20)); }
    function lpNowTime() { return new Date().toLocaleString("zh-CN", { hour12: false }); }

    var bc = null;
    try { bc = new BroadcastChannel("skyarrow_launch"); } catch (e) { bc = null; }

    function lpBroadcast(msg) {
        if (bc) bc.postMessage(msg);
    }

    /* 网络通道：ntfy.sh 免费消息服务，接收 GitHub Pages 用户端的点播，回推状态更新 */
    var LP_NTFY = "https://ntfy.sh/skyarrow-lj-launch-7f3k9x2q";
    function lpNetSend(obj) {
        try {
            fetch(LP_NTFY, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify(obj)
            }).catch(function () {});
        } catch (e) {}
    }
    function lpNetListen() {
        try {
            var es = new EventSource(LP_NTFY + "/sse");
            es.onmessage = function (ev) {
                var msg;
                try { msg = JSON.parse(ev.data); } catch (e) { return; }
                if (!msg || msg.type !== "new_ticket" || !msg.ticket || !msg.ticket.id) return;
                /* 按 id 去重：本地双标签页场景票已通过 localStorage 进来 */
                var tickets = lpGetTickets();
                if (tickets.find(function (x) { return x.id === msg.ticket.id; })) return;
                tickets.unshift(msg.ticket);
                lpSetTickets(tickets);
                renderBoss();
                toast("📡 收到新的点播单！（来自网络）");
                beep(980, 0.12, "sine", 0.06);
                setTimeout(function () { beep(1280, 0.15, "sine", 0.06); }, 150);
                lpNotify("📡 凌箭航天 · 新点播",
                    "「" + msg.ticket.rocket + " → " + msg.ticket.target + "」by " + msg.ticket.name);
            };
        } catch (e) {}
    }

    /* 同步频道消息（补拉历史 + 轮询兜底，SSE 断流也能收到） */
    function lpNetSync() {
        try {
            fetch(LP_NTFY + "/json?poll=1").then(function (r) { return r.text(); }).then(function (txt) {
                var added = 0, changed = 0;
                txt.split("\n").forEach(function (line) {
                    if (!line.trim()) return;
                    var ev; try { ev = JSON.parse(line); } catch (e) { return; }
                    if (ev.event !== "message" || !ev.message) return;
                    var msg; try { msg = JSON.parse(ev.message); } catch (e) { return; }
                    if (!msg || !msg.ticket || !msg.ticket.id) return;
                    var tickets = lpGetTickets();
                    var idx = tickets.findIndex(function (x) { return x.id === msg.ticket.id; });
                    if (msg.type === "new_ticket") {
                        if (idx < 0) { tickets.unshift(msg.ticket); lpSetTickets(tickets); added++; }
                    } else if (msg.type === "cancelled") {
                        if (idx >= 0) { tickets.splice(idx, 1); lpSetTickets(tickets); changed++; }
                    } else if (idx >= 0) {
                        tickets[idx] = msg.ticket; lpSetTickets(tickets); changed++;
                    }
                });
                if (added || changed) {
                    renderBoss();
                    if (added) {
                        toast("📡 收到 " + added + " 条新点播：" + lpGetTickets().filter(function (t) { return t.status === "waiting"; }).map(function (t) { return t.rocket; }).slice(0, 3).join("、"));
                        lpDing(); lpFlashTitle();
                        lpNotify("📡 收到新的发射点播", "快去博主接单台看看！", "");
                    }
                }
            }).catch(function () {});
        } catch (e) {}
    }

    /* Windows 系统通知（Notification API，弹系统级弹窗） */
    function lpNotify(title, body) {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            try { new Notification(title, { body: body, icon: "assets/images/favicon.png" }); } catch (e) {}
        } else if (Notification.permission === "default") {
            Notification.requestPermission().then(function (p) {
                if (p === "granted") { try { new Notification(title, { body: body, icon: "assets/images/favicon.png" }); } catch (e) {} }
            });
        }
    }

    /* 正在贴链接的票 id（内联输入框，比 prompt 好用且兼容性稳） */
    var bossEditing = null;

    /* ---- 队列渲染 ---- */
    function renderBoss() {
        var tickets = lpGetTickets();
        var waiting = tickets.filter(function (t) { return t.status === "waiting"; });
        var flying = tickets.filter(function (t) { return t.status === "approved"; });
        var done = tickets.filter(function (t) { return t.status === "done"; });

        $("#bossStat").innerHTML =
            "<div><b>" + waiting.length + "</b><span>待接单</span></div>" +
            "<div><b>" + flying.length + "</b><span>拍摄中</span></div>" +
            "<div><b>" + done.length + "</b><span>已发布</span></div>";

        var html = "";
        if (!waiting.length && !flying.length && !done.length) {
            html += "<p class='boss-empty'>暂时没有点播单。打开用户端 index.html 提交一条试试。</p>";
        }
        if (waiting.length) {
            html += "<p class='boss-h3'>📥 待接单队列（" + waiting.length + "）</p>";
            waiting.forEach(function (t) {
                html += "<div class='lp-ticket'>" +
                    "<span class='t-icon'>🚀</span>" +
                    "<div class='t-info'><div class='t-name'>" + t.rocket + " → " + t.target + "</div>" +
                    "<div class='t-meta'>" + t.name + " · " + t.time + (t.custom ? " · 自定义火箭" : "") + "</div></div>" +
                    "<div class='t-actions'>" +
                    "<button class='t-fuse' data-boss-fire='" + t.id + "'>🎬 接单拍摄</button>" +
                    "<button class='t-del' data-boss-del='" + t.id + "'>取消</button></div></div>";
            });
        }
        if (flying.length) {
            html += "<p class='boss-h3'>🎬 拍摄中（" + flying.length + "）—— 拍完抖音视频后贴链接</p>";
            flying.forEach(function (t) {
                html += "<div class='lp-ticket'>" +
                    "<span class='t-icon'>🎬</span>" +
                    "<div class='t-info'><div class='t-name'>" + t.rocket + " → " + t.target + "</div>" +
                    "<div class='t-meta'>" + t.name + " · 接单于 " + (t.firedAt || t.time) + "</div></div>" +
                    urlForm(t, "<button class='t-fuse' data-boss-video='" + t.id + "'>📎 贴抖音链接</button>") +
                    "</div>";
            });
        }
        if (done.length) {
            html += "<p class='boss-h3'>✅ 已发布（近 5 条）</p>";
            done.slice(0, 5).forEach(function (t) {
                html += "<div class='lp-ticket boss-done'>" +
                    "<span class='t-icon'>✅</span>" +
                    "<div class='t-info'><div class='t-name'>" + t.rocket + " → " + t.target + "</div>" +
                    "<div class='t-meta'>" + t.name + " · 发布于 " + (t.doneAt || t.firedAt || t.time) + "</div></div>" +
                    urlForm(t,
                        (t.video ? "<a class='t-fuse' href='" + t.video + "' target='_blank' rel='noopener'>▶ 看视频</a>" : "") +
                        "<button class='t-del' data-boss-video='" + t.id + "'>改链接</button>") +
                    "</div>";
            });
        }
        $("#bossQueue").innerHTML = html;
        /* 输入框展开时自动聚焦 */
        if (bossEditing) {
            var inp = $("#bossUrl-" + CSS.escape(bossEditing));
            if (inp) { inp.focus(); inp.select(); }
        }
    }

    /* 若该票正处于编辑状态，渲染内联链接输入框；否则渲染传入的按钮组 */
    function urlForm(t, buttons) {
        if (bossEditing !== t.id) return "<div class='t-actions'>" + buttons + "</div>";
        return "<div class='t-urlform'>" +
            "<input type='url' id='bossUrl-" + t.id + "' placeholder='粘贴抖音视频链接，回车确认' value='" + (t.video || "") + "'>" +
            "<button class='t-fuse' data-boss-save='" + t.id + "'>确认发布</button>" +
            "<button class='t-del' data-boss-cancel>取消</button></div>";
    }

    /* ---- 博主操作 ---- */
    function bossFire(id) {
        var tickets = lpGetTickets();
        var t = tickets.find(function (x) { return x.id === id; });
        if (!t) return;
        t.status = "approved";
        t.firedAt = lpNowTime();
        lpSetTickets(tickets);
        lpBroadcast({ type: "launch", ticket: t });
        lpNetSend({ type: "accepted", ticket: t });
        renderBoss();
        toast("🎬 已接单！粉丝端会弹出 Windows 通知");
    }

    function bossVideo(id) {
        bossEditing = id;
        renderBoss();
    }

    function bossSave(id) {
        var inp = $("#bossUrl-" + CSS.escape(id));
        var url = inp ? inp.value.trim() : "";
        if (!url) { toast("链接不能为空"); if (inp) inp.focus(); return; }
        var tickets = lpGetTickets();
        var t = tickets.find(function (x) { return x.id === id; });
        if (!t) return;
        t.video = url;
        t.status = "done";
        t.doneAt = lpNowTime();
        lpSetTickets(tickets);
        bossEditing = null;
        if (bc) bc.postMessage({ type: "tickets_changed" });
        lpNetSend({ type: "done", ticket: t });
        renderBoss();
        toast("✅ 已发布！粉丝端出现观看按钮");
        beep(880, 0.12, "sine", 0.06);
    }

    function bossDel(id) {
        var cancelled = lpGetTickets().find(function (t) { return t.id === id; });
        lpSetTickets(lpGetTickets().filter(function (t) { return t.id !== id; }));
        if (bc) bc.postMessage({ type: "tickets_changed" });
        if (cancelled) lpNetSend({ type: "cancelled", ticket: cancelled });
        renderBoss();
        toast("已取消该申请");
    }

    function bossClear() {
        lpSetTickets(lpGetTickets().filter(function (t) { return t.status !== "done"; }));
        if (bc) bc.postMessage({ type: "tickets_changed" });
        renderBoss();
        toast("已清空发射记录");
    }

    /* ---- 接收用户端消息 ---- */
    if (bc) {
        bc.onmessage = function (ev) {
            if (ev.data.type === "new_ticket") {
                renderBoss();
                toast("📡 收到新的点播单！");
                beep(980, 0.12, "sine", 0.06);
                setTimeout(function () { beep(1280, 0.15, "sine", 0.06); }, 150);
                var latest = lpGetTickets()[0];
                lpNotify("📡 凌箭航天 · 新点播",
                    latest ? ("「" + latest.rocket + " → " + latest.target + "」by " + latest.name) : "快去接单台看看");
            } else if (ev.data.type === "tickets_changed") {
                renderBoss();
            }
        };
    }
    /* storage 事件兜底：同 origin 其他标签页改写票据时刷新 */
    window.addEventListener("storage", function (e) {
        if (e.key === lpTicketKey) renderBoss();
    });
    /* 首次点击页面时请求通知权限（浏览器要求用户手势后才能授权） */
    document.addEventListener("click", function reqPerm() {
        if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
        document.removeEventListener("click", reqPerm);
    });

    /* ---- 事件委托 ---- */
    document.addEventListener("click", function (e) {
        var t;
        if ((t = e.target.closest("[data-boss-fire]"))) { bossFire(t.getAttribute("data-boss-fire")); return; }
        if ((t = e.target.closest("[data-boss-del]"))) { bossDel(t.getAttribute("data-boss-del")); return; }
        if ((t = e.target.closest("[data-boss-video]"))) { bossVideo(t.getAttribute("data-boss-video")); return; }
        if ((t = e.target.closest("[data-boss-save]"))) { bossSave(t.getAttribute("data-boss-save")); return; }
        if (e.target.closest("[data-boss-cancel]")) { bossEditing = null; renderBoss(); return; }
        if (e.target.closest("[data-boss-clear]")) { bossClear(); return; }
    });

    /* 输入框回车 = 确认发布 */
    document.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        var inp = e.target.closest("[id^='bossUrl-']");
        if (inp) bossSave(inp.id.slice(8));
    });

    renderBoss();
    lpNetSync();
    lpNetListen();
    setInterval(lpNetSync, 5000);
    console.log("%c📡 凌箭航天 · 博主接单台已就绪（网络通道已连接）", "color:#6FD6E8;font-size:14px");
})();
