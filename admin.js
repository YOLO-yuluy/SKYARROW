/* ============================================================
   凌箭航天 · 博主控制台 admin.js
   纯前端、零依赖；与用户端共用 localStorage 键与 ntfy 主题。
   ============================================================ */

(function () {
    "use strict";

    var K = {
        tickets: "skyarrow_launch_tickets",
        danmaku: "skyarrow_danmaku",
        msgs: "skyarrow_msgs",
        votes: "skyarrow_votes",
        genbook: "skyarrow_genbook",
        visits: "skyarrow_visits",
        favs: "skyarrow_favs",
        ach: "skyarrow_ach",
        admin: "skyarrow_admin",
        log: "skyarrow_admin_log",
        tomb: "skyarrow_admin_tomb"
    };

    var NTFY = "https://ntfy.sh/skyarrow-lj-launch-7f3k9x2q";
    var VOTE_NAMES = ["长征七号", "长征八号", "猎鹰9号", "乳齿象发动机"];

    var SESSION_KEY = "skyarrow_admin_until";
    var SESSION_MS = 8 * 60 * 60 * 1000;

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    var state = {
        view: "overview",
        filter: "all",
        query: "",
        ctab: "dm",
        net: "check",
        lastMsg: null,
        bc: null,
        es: null,
        pollTimer: null,
        searchTimer: null
    };

    /* ---------------- 基础工具 ---------------- */

    function read(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            return JSON.parse(raw);
        } catch (e) { return fallback; }
    }

    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch (e) { return false; }
    }

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function safeUrl(u) {
        try {
            var url = new URL(String(u), location.href);
            if (url.protocol !== "http:" && url.protocol !== "https:") return null;
            return url.href;
        } catch (e) { return null; }
    }

    function stamp(date) {
        var d = date || new Date();
        var parts;
        try {
            parts = new Intl.DateTimeFormat("zh-CN", {
                timeZone: "Asia/Shanghai",
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", second: "2-digit",
                hour12: false
            }).formatToParts(d);
        } catch (e) {
            parts = null;
        }
        if (!parts) {
            var p = function (n) { return n < 10 ? "0" + n : String(n); };
            return d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " +
                p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
        }
        var map = {};
        parts.forEach(function (x) { map[x.type] = x.value; });
        return map.year + "/" + map.month + "/" + map.day + " " + map.hour + ":" + map.minute + ":" + map.second;
    }

    function clockText() {
        try {
            return new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
        } catch (e) {
            var d = new Date();
            var p = function (n) { return n < 10 ? "0" + n : String(n); };
            return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
        }
    }

    function toast(message) {
        var el = $("#toast");
        if (!el) return;
        el.textContent = message;
        el.classList.add("is-on");
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { el.classList.remove("is-on"); }, 2200);
    }

    function sha(text) {
        if (window.crypto && window.crypto.subtle && window.TextEncoder) {
            return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
                .then(function (buf) {
                    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                        return ("0" + b.toString(16)).slice(-2);
                    }).join("");
                });
        }
        /* 非安全上下文兜底：弱哈希，仅用于本机防误入 */
        var h = 2166136261;
        for (var i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = (h * 16777619) >>> 0;
        }
        return Promise.resolve("fnv" + h.toString(16));
    }

    function passwordHash(pass) {
        return sha("skyarrow-admin::" + pass);
    }

    /* ---------------- 数据 ---------------- */

    function getTickets() {
        var list = read(K.tickets, []);
        return Array.isArray(list) ? list : [];
    }

    /* 被移出/清理过的票据 id：ntfy 会回放历史消息，靠这个名单避免“删了又回来” */
    function getTomb() {
        var list = read(K.tomb, []);
        return Array.isArray(list) ? list : [];
    }

    function addTomb(ids) {
        var list = getTomb();
        ids.forEach(function (id) {
            if (id && list.indexOf(id) < 0) list.unshift(id);
        });
        write(K.tomb, list.slice(0, 100));
    }

    function setTickets(list, opts) {
        write(K.tickets, list.slice(0, 20));
        if (!opts || !opts.silent) {
            if (state.bc) { try { state.bc.postMessage({ type: "tickets_changed" }); } catch (e) {} }
        }
        renderAll();
    }

    function send(type, ticket) {
        var payload = { type: type };
        if (ticket) payload.ticket = ticket;
        try {
            fetch(NTFY, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify(payload)
            }).catch(function () {});
        } catch (e) {}
    }

    function addLog(text) {
        var logs = read(K.log, []);
        if (!Array.isArray(logs)) logs = [];
        logs.unshift({ t: stamp(), a: text });
        write(K.log, logs.slice(0, 60));
        renderLogs();
    }

    /* ---------------- 登录门 ---------------- */

    var setupMode = false;

    function initGate() {
        var cfg = read(K.admin, null);
        setupMode = !cfg || !cfg.hash;

        var form = $("#gateForm");
        if (setupMode) {
            $("#gateTitle").textContent = "设置管理密码";
            $("#gateSub").textContent = "第一次打开控制台，先给这台设备设一个密码。密码只保存为哈希，不上传。";
            $("#gatePass2Field").hidden = false;
            $("#gateBtn").textContent = "设置并进入";
        }

        var until = Number(sessionStorage.getItem(SESSION_KEY) || 0);
        if (!setupMode && until > Date.now()) { enter(); return; }

        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            var pass = $("#gatePass").value;
            var hint = $("#gateHint");

            if (pass.length < 6) { hint.textContent = "密码至少 6 位。"; return; }

            if (setupMode) {
                var pass2 = $("#gatePass2").value;
                if (pass !== pass2) { hint.textContent = "两次输入不一致。"; return; }
                passwordHash(pass).then(function (hash) {
                    write(K.admin, { hash: hash, createdAt: stamp(), fails: 0, lockUntil: 0 });
                    sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_MS));
                    addLog("首次设置管理密码");
                    enter();
                });
                return;
            }

            cfg = read(K.admin, null);
            if (cfg.lockUntil && Date.now() < cfg.lockUntil) {
                hint.textContent = "尝试过多，请 " + Math.ceil((cfg.lockUntil - Date.now()) / 1000) + " 秒后再试。";
                return;
            }

            passwordHash(pass).then(function (hash) {
                if (hash !== cfg.hash) {
                    cfg.fails = (cfg.fails || 0) + 1;
                    if (cfg.fails >= 5) {
                        cfg.lockUntil = Date.now() + 60000;
                        cfg.fails = 0;
                        hint.textContent = "连续输错 5 次，锁定 60 秒。";
                    } else {
                        hint.textContent = "密码不对，还可以试 " + (5 - cfg.fails) + " 次。";
                    }
                    write(K.admin, cfg);
                    return;
                }
                cfg.fails = 0;
                cfg.lockUntil = 0;
                write(K.admin, cfg);
                sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_MS));
                addLog("登录控制台");
                enter();
            });
        });
    }

    function enter() {
        $("#gate").hidden = true;
        $("#shell").hidden = false;
        init();
        var hash = (location.hash || "").replace("#", "");
        if (["overview", "tickets", "content", "channel", "security"].indexOf(hash) >= 0) {
            setView(hash);
        }
    }

    /* ---------------- 初始化 ---------------- */

    var inited = false;

    function init() {
        if (inited) return;
        inited = true;

        try { state.bc = new BroadcastChannel("skyarrow_launch"); } catch (e) { state.bc = null; }
        if (state.bc) {
            state.bc.onmessage = function (ev) {
                var data = ev.data || {};
                if (data.type === "tickets_changed") renderAll();
                if (data.ticket && data.ticket.id) applyRemote(data);
            };
        }

        window.addEventListener("storage", function (ev) {
            if (ev.key === K.tickets || ev.key === K.danmaku || ev.key === K.msgs ||
                ev.key === K.votes || ev.key === K.genbook) {
                renderAll();
            }
        });

        $$(".rail-item").forEach(function (b) {
            b.addEventListener("click", function () { setView(b.getAttribute("data-view")); });
        });

        window.addEventListener("hashchange", function () {
            var h = (location.hash || "").replace("#", "");
            if (["overview", "tickets", "content", "channel", "security"].indexOf(h) >= 0 && h !== state.view) {
                setView(h);
            }
        });

        $$("[data-goto]").forEach(function (b) {
            b.addEventListener("click", function () { setView(b.getAttribute("data-goto")); });
        });

        $$(".tab[data-filter]").forEach(function (b) {
            b.addEventListener("click", function () {
                state.filter = b.getAttribute("data-filter");
                $$(".tab[data-filter]").forEach(function (x) {
                    var on = x === b;
                    x.classList.toggle("is-active", on);
                    x.setAttribute("aria-selected", on ? "true" : "false");
                });
                renderTickets();
            });
        });

        $$(".tab[data-ctab]").forEach(function (b) {
            b.addEventListener("click", function () {
                state.ctab = b.getAttribute("data-ctab");
                $$(".tab[data-ctab]").forEach(function (x) {
                    var on = x === b;
                    x.classList.toggle("is-active", on);
                    x.setAttribute("aria-selected", on ? "true" : "false");
                });
                renderContent();
            });
        });

        $("#ticketSearch").addEventListener("input", function () {
            clearTimeout(state.searchTimer);
            var v = this.value;
            state.searchTimer = setTimeout(function () { state.query = v.trim(); renderTickets(); }, 140);
        });

        $("#ticketBody").addEventListener("click", onTicketAction);

        $("#exportBtn").addEventListener("click", exportTickets);
        $("#clearDoneBtn").addEventListener("click", clearDone);
        $("#backupBtn").addEventListener("click", exportAll);
        $("#wipeBtn").addEventListener("click", wipeAll);
        $("#copyTopic").addEventListener("click", copyTopic);
        $("#testBtn").addEventListener("click", function () {
            send("admin_ping", { at: stamp() });
            toast("测试消息已发出，看用户端通道状态与这里是否都正常");
            addLog("发送通道测试消息");
        });
        $("#reconnectBtn").addEventListener("click", function () { connectNet(); toast("已重新连接消息通道"); });

        $("#passForm").addEventListener("submit", changePassword);
        $("#logoutBtn").addEventListener("click", function () {
            sessionStorage.removeItem(SESSION_KEY);
            addLog("退出控制台");
            location.reload();
        });

        $("#railToggle").addEventListener("click", function () {
            var rail = $("#rail");
            var open = rail.classList.toggle("is-open");
            this.setAttribute("aria-expanded", open ? "true" : "false");
        });

        $$("[data-clear]").forEach(function (b) {
            b.addEventListener("click", function () { clearContent(b.getAttribute("data-clear")); });
        });

        document.addEventListener("keydown", function (ev) {
            if (ev.key === "Escape") {
                if (!$("#modal").hidden) closeModal(false);
                else $("#rail").classList.remove("is-open");
            }
            if (ev.key === "Enter" && !$("#modal").hidden) {
                if (document.activeElement === $("#modalInput")) $("#modalOk").click();
            }
        });

        $("#modal").addEventListener("click", function (ev) {
            if (ev.target.closest("[data-modal-close]")) closeModal(false);
        });

        $("#clock").textContent = clockText();
        setInterval(function () { $("#clock").textContent = clockText(); }, 1000);

        renderAll();
        connectNet();
        if (state.pollTimer) clearInterval(state.pollTimer);
        state.pollTimer = setInterval(pollNet, 5000);
        updateNetPill();
    }

    /* ---------------- 视图切换 ---------------- */

    function setView(name) {
        state.view = name;
        $$(".view").forEach(function (v) { v.hidden = v.id !== "view-" + name; });
        $$(".rail-item").forEach(function (b) {
            var on = b.getAttribute("data-view") === name;
            b.classList.toggle("is-active", on);
            if (on) b.setAttribute("aria-current", "page");
            else b.removeAttribute("aria-current");
        });
        var names = { overview: ["总览", "运行状态"], tickets: ["接单台", "点播队列"], content: ["内容审核", "站内内容"], channel: ["消息通道", "链路与部署"], security: ["安全与日志", "账号与风险"] };
        var pair = names[name] || names.overview;
        $("#crumb").innerHTML = esc(pair[0]) + "<span>/ " + esc(pair[1]) + "</span>";
        try { history.replaceState(null, "", "#" + name); } catch (e) {}
        $("#rail").classList.remove("is-open");
        if (name === "overview" || name === "tickets") renderAll();
    }

    /* ---------------- 渲染 ---------------- */

    function renderAll() {
        renderKpis();
        renderRecent();
        renderTodo();
        renderBars();
        renderTickets();
        renderContent();
        renderChannel();
        renderLogs();
    }

    var STATUS = {
        waiting: { label: "待接单", s: "waiting" },
        approved: { label: "拍摄中", s: "approved" },
        done: { label: "已发布", s: "done" }
    };

    function counts() {
        var t = getTickets(), c = { all: t.length, waiting: 0, approved: 0, done: 0 };
        t.forEach(function (x) {
            if (x.status === "waiting") c.waiting++;
            else if (x.status === "approved") c.approved++;
            else if (x.status === "done") c.done++;
        });
        return c;
    }

    function renderKpis() {
        var c = counts();
        $$("[data-kpi]").forEach(function (el) {
            var k = el.getAttribute("data-kpi");
            var v = k === "total" ? c.all : c[k];
            el.textContent = Number(v || 0).toLocaleString("zh-CN");
        });
        var badge = $("#railBadge");
        if (badge) {
            badge.textContent = String(c.waiting);
            badge.hidden = c.waiting === 0;
        }
        $$("[data-count]").forEach(function (el) {
            el.textContent = String(c[el.getAttribute("data-count")] || 0);
        });
    }

    function chip(status) {
        var s = STATUS[status] || { label: "未知", s: "waiting" };
        return '<span class="chip" data-s="' + s.s + '">' + esc(s.label) + "</span>";
    }

    function renderRecent() {
        var list = getTickets().slice(0, 5);
        var box = $("#recentTickets");
        if (!list.length) {
            box.innerHTML = '<p class="empty">队列为空。用户端提交点播后会出现在这里。</p>';
            return;
        }
        box.innerHTML = list.map(function (t) {
            return '<div class="feed-item">' +
                '<div class="feed-main"><b>' + esc(t.name || "匿名访客") + " · " + esc(t.rocket || "未填火箭") + "</b>" +
                "<span>" + esc(t.target || "未选目标") + " · " + esc(t.time || "") + "</span></div>" +
                '<div class="feed-side">' + chip(t.status) + "</div></div>";
        }).join("");
    }

    function renderTodo() {
        var c = counts();
        var items = [];
        if (c.waiting) items.push("<li><b>" + c.waiting + "</b> 条点播待接单</li>");
        if (c.approved) items.push("<li><b>" + c.approved + "</b> 条已接单，等贴抖音链接</li>");
        if (state.net === "offline") items.push('<li class="ok">通道离线：跨设备暂时收不到新点播</li>');
        if (c.done) items.push("<li><b>" + c.done + "</b> 条已发布，可在用户端跳转</li>");
        if (!items.length) items.push("<li>队列已清空，没有待办。</li>");
        $("#todoList").innerHTML = items.join("");
    }

    function renderBars() {
        var dm = read(K.danmaku, []), msgs = read(K.msgs, []), book = read(K.genbook, []);
        var favs = read(K.favs, []), visits = Number(read(K.visits, 0)) || 0;
        var rows = [
            ["弹幕", Array.isArray(dm) ? dm.length : 0, 100],
            ["留言", Array.isArray(msgs) ? msgs.length : 0, 80],
            ["设计本", Array.isArray(book) ? book.length : 0, 40],
            ["本机访问", visits, Math.max(visits, 50)]
        ];
        $("#contentBars").innerHTML = rows.map(function (r) {
            var pct = Math.min(100, Math.round(r[1] / r[2] * 100));
            return '<div class="cbar"><p><span>' + esc(r[0]) + "</span><b>" + Number(r[1]).toLocaleString("zh-CN") + "</b></p>" +
                '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
        }).join("");
    }

    function filteredTickets() {
        var q = state.query.toLowerCase();
        return getTickets().filter(function (t) {
            if (state.filter !== "all" && t.status !== state.filter) return false;
            if (!q) return true;
            return [t.name, t.rocket, t.target, t.id].join(" ").toLowerCase().indexOf(q) >= 0;
        });
    }

    function renderTickets() {
        var list = filteredTickets();
        var body = $("#ticketBody");
        var empty = $("#ticketEmpty");

        body.innerHTML = list.map(function (t) {
            var video = t.video && safeUrl(t.video);
            var actions = "";
            if (t.status === "waiting") {
                actions = '<button class="btn btn-primary btn-sm" data-act="accept" data-id="' + esc(t.id) + '">接单拍摄</button>' +
                    '<button class="btn btn-ghost btn-sm" data-act="cancel" data-id="' + esc(t.id) + '">取消</button>';
            } else if (t.status === "approved") {
                actions = '<button class="btn btn-primary btn-sm" data-act="done" data-id="' + esc(t.id) + '">贴抖音链接</button>' +
                    '<button class="btn btn-ghost btn-sm" data-act="cancel" data-id="' + esc(t.id) + '">取消</button>';
            } else {
                actions = '<button class="btn btn-ghost btn-sm" data-act="cancel" data-id="' + esc(t.id) + '">移出</button>';
            }
            return "<tr>" +
                '<td><span class="cell-main">' + esc(t.name || "匿名访客") + "</span>" +
                (t.custom ? '<span class="cell-sub">自定义火箭</span>' : "") + "</td>" +
                '<td><span class="cell-main">' + esc(t.rocket || "—") + "</span>" +
                '<span class="cell-sub">→ ' + esc(t.target || "—") + "</span></td>" +
                '<td class="time">' + esc(t.time || "—") + "</td>" +
                "<td>" + chip(t.status) + "</td>" +
                '<td>' + (video ? '<a class="video-link" href="' + esc(video) + '" target="_blank" rel="noopener" title="' + esc(video) + '">抖音 ↗</a>' : '<span class="time">—</span>') + "</td>" +
                '<td class="ta-right"><div class="row-actions">' + actions + "</div></td>" +
                "</tr>";
        }).join("");

        empty.hidden = list.length > 0;
        $("#ticketTable").hidden = list.length === 0;
    }

    function onTicketAction(ev) {
        var b = ev.target.closest("[data-act]");
        if (!b) return;
        var id = b.getAttribute("data-id");
        var act = b.getAttribute("data-act");
        var list = getTickets();
        var idx = list.findIndex(function (x) { return x.id === id; });
        if (idx < 0) { toast("这条点播已经不在队列里"); return; }
        var t = list[idx];

        if (act === "accept") {
            t.status = "approved";
            t.firedAt = stamp();
            list[idx] = t;
            setTickets(list);
            send("accepted", t);
            addLog("接单：" + (t.name || "匿名") + " · " + (t.rocket || ""));
            toast("已接单，用户端会显示拍摄中");
            return;
        }

        if (act === "done") {
            askInput({
                title: "贴抖音链接",
                desc: "「" + (t.rocket || "点播") + "」发布后，把视频地址粘进来。用户端会出现观看按钮。",
                label: "视频链接",
                value: t.video || "",
                placeholder: "https://www.douyin.com/video/…"
            }).then(function (url) {
                if (!url) return;
                var safe = safeUrl(url);
                if (!safe) { toast("只接受 http/https 链接"); return; }
                t.status = "done";
                t.video = safe;
                t.doneAt = stamp();
                list[idx] = t;
                setTickets(list);
                send("done", t);
                addLog("发布视频：" + safe);
                toast("已发布，用户端可以跳转抖音了");
            });
            return;
        }

        if (act === "cancel") {
            confirmBox({
                title: "移出这条点播？",
                desc: "「" + (t.name || "匿名") + " · " + (t.rocket || "") + "」会从队列里删除，用户端也会同步消失。",
                ok: "移出"
            }).then(function (ok) {
                if (!ok) return;
                addTomb([t.id]);
                list.splice(idx, 1);
                setTickets(list);
                send("cancelled", t);
                addLog("移出点播：" + (t.name || "匿名") + " · " + (t.rocket || ""));
                toast("已移出");
            });
        }
    }

    function clearDone() {
        var done = getTickets().filter(function (t) { return t.status === "done"; });
        if (!done.length) { toast("没有已发布的点播"); return; }
        confirmBox({
            title: "清理已发布？",
            desc: "将移出 " + done.length + " 条已完成的点播。视频链接会一并删除，抖音上的视频不受影响。",
            ok: "清理"
        }).then(function (ok) {
            if (!ok) return;
            addTomb(done.map(function (t) { return t.id; }));
            setTickets(getTickets().filter(function (t) { return t.status !== "done"; }));
            addLog("清理已发布 " + done.length + " 条");
            toast("已清理 " + done.length + " 条");
        });
    }

    function exportTickets() {
        download("skyarrow-tickets-" + dateFile() + ".json", JSON.stringify(getTickets(), null, 2));
        addLog("导出点播 JSON");
        toast("已导出点播 JSON");
    }

    function exportAll() {
        var data = {};
        Object.keys(K).forEach(function (key) {
            if (key === "admin" || key === "log") return;
            data[key] = read(K[key], null);
        });
        download("skyarrow-backup-" + dateFile() + ".json", JSON.stringify(data, null, 2));
        addLog("导出全部数据");
        toast("已导出全部数据");
    }

    function dateFile() {
        var d = new Date(), p = function (n) { return n < 10 ? "0" + n : String(n); };
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
    }

    function download(name, text) {
        var blob = new Blob([text], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    /* ---------------- 内容审核 ---------------- */

    function renderContent() {
        var dm = read(K.danmaku, []); if (!Array.isArray(dm)) dm = [];
        var msgs = read(K.msgs, []); if (!Array.isArray(msgs)) msgs = [];
        var book = read(K.genbook, []); if (!Array.isArray(book)) book = [];

        $("#cntDm").textContent = dm.length;
        $("#cntMsg").textContent = msgs.length;
        $("#cntBook").textContent = book.length;

        $("#dmList").innerHTML = dm.map(function (m, i) {
            return '<li><div class="mod-main"><p>' + esc(m.t) + "</p><span>" + esc(m.d || "") + " · #" + (i + 1) + "</span></div>" +
                '<button class="mod-del" data-del="dm" data-i="' + i + '" title="删除">✕</button></li>';
        }).join("");
        $("#dmEmpty").hidden = dm.length > 0;

        $("#msgList").innerHTML = msgs.map(function (m, i) {
            return '<li><div class="mod-main"><p>' + esc(m.t) + "</p><span>" + esc(m.n || "神秘宇航员") + " · " + esc(m.d || "") + "</span></div>" +
                '<button class="mod-del" data-del="msg" data-i="' + i + '" title="删除">✕</button></li>';
        }).join("");
        $("#msgEmpty").hidden = msgs.length > 0;

        var votes = read(K.votes, {});
        if (!votes || typeof votes !== "object") votes = {};
        var rawTotal = VOTE_NAMES.reduce(function (s, n, i) { return s + (Number(votes[i]) || 0); }, 0);
        $("#cntVote").textContent = rawTotal;
        var total = rawTotal || 1;
        $("#voteView").innerHTML = VOTE_NAMES.map(function (name, i) {
            var c = Number(votes[i]) || 0;
            var pct = (c / total * 100).toFixed(1);
            return '<div class="vote-row"><p><span>' + esc(name) + "</span><b>" + c + " 票 · " + pct + "%</b></p>" +
                '<div class="vote-bar"><i style="width:' + pct + '%"></i></div></div>';
        }).join("") + '<p class="foot-note">总票数 ' + rawTotal + "。数据只存本机。</p>";

        $("#bookList").innerHTML = book.map(function (b, i) {
            return '<li><div class="mod-main"><p>' + esc(b.icon || "") + " " + esc(b.title || "未命名") + "</p>" +
                "<span>" + esc(b.sub || "") + " · " + esc(b.time || "") + "</span></div>" +
                '<button class="mod-del" data-del="book" data-i="' + i + '" title="删除">✕</button></li>';
        }).join("");
        $("#bookEmpty").hidden = book.length > 0;

        $("#paneDm").hidden = state.ctab !== "dm";
        $("#paneMsg").hidden = state.ctab !== "msg";
        $("#paneVote").hidden = state.ctab !== "vote";
        $("#paneBook").hidden = state.ctab !== "book";

        $$("[data-del]").forEach(function (b) {
            b.onclick = function () {
                var kind = b.getAttribute("data-del");
                var i = Number(b.getAttribute("data-i"));
                var key = kind === "dm" ? K.danmaku : kind === "msg" ? K.msgs : K.genbook;
                var list = read(key, []);
                if (!Array.isArray(list)) list = [];
                list.splice(i, 1);
                write(key, list);
                renderContent();
                addLog("删除一条" + (kind === "dm" ? "弹幕" : kind === "msg" ? "留言" : "设计本记录"));
                toast("已删除");
            };
        });
    }

    function clearContent(kind) {
        var map = { dm: K.danmaku, msg: K.msgs, vote: K.votes, book: K.genbook };
        var key = map[kind];
        if (!key) return;
        confirmBox({
            title: "清空这类内容？",
            desc: "该操作会直接删除本机存储里的记录，不可恢复。",
            ok: "清空"
        }).then(function (ok) {
            if (!ok) return;
            write(key, kind === "vote" ? {} : []);
            renderAll();
            addLog("清空" + (kind === "dm" ? "弹幕" : kind === "msg" ? "留言" : kind === "vote" ? "投票" : "设计本"));
            toast("已清空");
        });
    }

    /* ---------------- 通道 ---------------- */

    function updateNetPill() {
        var labels = { check: "连接中", online: "通道在线", offline: "通道离线" };
        ["#netPill", "#netPill2"].forEach(function (sel) {
            var el = $(sel);
            if (el) el.setAttribute("data-state", state.net);
        });
        ["#netText", "#netText2"].forEach(function (sel) {
            var el = $(sel);
            if (el) el.textContent = labels[state.net] || labels.check;
        });
        var dot = $("#railDot");
        if (dot) dot.setAttribute("data-state", state.net);
        renderTodo();
    }

    function setNet(s) {
        if (state.net === s) return;
        state.net = s;
        updateNetPill();
    }

    function connectNet() {
        if (state.es) { try { state.es.close(); } catch (e) {} state.es = null; }
        setNet("check");
        try {
            state.es = new EventSource(NTFY + "/sse");
            state.es.onopen = function () { setNet("online"); };
            state.es.onerror = function () { setNet("offline"); };
            state.es.onmessage = function (ev) {
                var msg;
                try { msg = JSON.parse(ev.data); } catch (e) { return; }
                applyRemote(msg, ev.time);
                setNet("online");
            };
        } catch (e) { setNet("offline"); }
    }

    function pollNet() {
        try {
            fetch(NTFY + "/json?poll=1").then(function (r) { return r.text(); }).then(function (txt) {
                txt.split("\n").forEach(function (line) {
                    if (!line.trim()) return;
                    var ev;
                    try { ev = JSON.parse(line); } catch (e) { return; }
                    if (ev.event !== "message" || !ev.message) return;
                    var msg;
                    try { msg = JSON.parse(ev.message); } catch (e) { return; }
                    applyRemote(msg, ev.time);
                });
                setNet("online");
            }).catch(function () { setNet("offline"); });
        } catch (e) {}
    }

    function applyRemote(msg, msgTime) {
        if (!msg || !msg.type) return;
        if (msg.type === "admin_ping") {
            state.lastMsg = stamp();
            renderChannel();
            return;
        }
        if (!msg.ticket || !msg.ticket.id) return;

        var t = msg.ticket;
        var list = getTickets();
        var idx = list.findIndex(function (x) { return x.id === t.id; });
        var changed = false;

        if (msg.type === "new_ticket") {
            if (getTomb().indexOf(t.id) >= 0) return;
            /* ntfy 会回放历史，超过 12 小时的新票不再往队列里塞 */
            if (msgTime && (Date.now() / 1000 - Number(msgTime)) > 12 * 3600) return;
            if (idx < 0) { list.unshift(t); changed = true; toast("收到新点播：" + (t.name || "匿名") + " · " + (t.rocket || "")); }
        } else if (msg.type === "cancelled") {
            if (idx >= 0) { addTomb([t.id]); list.splice(idx, 1); changed = true; }
        } else {
            if (idx >= 0) { list[idx] = t; changed = true; }
        }

        if (changed) setTickets(list, { silent: true });
        state.lastMsg = stamp();
        renderChannel();
    }

    function renderChannel() {
        var topic = $("#topicText");
        if (topic) topic.textContent = NTFY.replace("https://", "");
        var last = $("#lastMsg");
        if (last) last.textContent = state.lastMsg || "暂未收到";
        updateNetPill();
    }

    function copyTopic() {
        var text = NTFY.replace("https://", "");
        var done = function () { toast("主题已复制"); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
        } else { fallbackCopy(text); done(); }
    }

    function fallbackCopy(text) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        ta.remove();
    }

    /* ---------------- 日志与账号 ---------------- */

    function renderLogs() {
        var logs = read(K.log, []);
        if (!Array.isArray(logs)) logs = [];
        $("#logList").innerHTML = logs.map(function (l) {
            return "<li><time>" + esc(l.t) + "</time><span>" + esc(l.a) + "</span></li>";
        }).join("");
        $("#logEmpty").hidden = logs.length > 0;
    }

    function changePassword(ev) {
        ev.preventDefault();
        var p1 = $("#newPass").value, p2 = $("#newPass2").value;
        if (p1.length < 6) { toast("新密码至少 6 位"); return; }
        if (p1 !== p2) { toast("两次输入的密码不一致"); return; }
        passwordHash(p1).then(function (hash) {
            var cfg = read(K.admin, null) || {};
            cfg.hash = hash;
            cfg.updatedAt = stamp();
            write(K.admin, cfg);
            $("#passForm").reset();
            addLog("更新管理密码");
            toast("密码已更新，下次进入用新密码");
        });
    }

    function wipeAll() {
        confirmBox({
            title: "清空全部本机数据？",
            desc: "点播、弹幕、留言、投票、设计本、成就、日志都会被删除，且无法恢复。密码设置会保留。",
            ok: "全部清空"
        }).then(function (ok) {
            if (!ok) return;
            Object.keys(K).forEach(function (key) {
                if (key === "admin") return;
                try { localStorage.removeItem(K[key]); } catch (e) {}
            });
            sessionStorage.removeItem(SESSION_KEY);
            addLog("清空全部本机数据");
            location.reload();
        });
    }

    /* ---------------- 弹窗 ---------------- */

    var modalResolve = null;

    function openModal(opts) {
        $("#modalTitle").textContent = opts.title || "确认";
        $("#modalDesc").textContent = opts.desc || "";
        $("#modalError").textContent = "";
        $("#modalOk").textContent = opts.ok || "确定";
        var field = $("#modalField");
        var input = $("#modalInput");
        if (opts.input) {
            field.hidden = false;
            $("#modalLabel").textContent = opts.label || "输入";
            input.value = opts.value || "";
            input.placeholder = opts.placeholder || "";
        } else {
            field.hidden = true;
            input.value = "";
        }
        $("#modal").hidden = false;
        $("#modal").setAttribute("aria-hidden", "false");
        if (opts.input) setTimeout(function () { input.focus(); input.select(); }, 30);
        else setTimeout(function () { $("#modalOk").focus(); }, 30);
    }

    function closeModal(result) {
        $("#modal").hidden = true;
        $("#modal").setAttribute("aria-hidden", "true");
        var fn = modalResolve;
        modalResolve = null;
        if (fn) fn(result);
    }

    $("#modalOk").addEventListener("click", function () {
        var field = $("#modalField");
        if (!field.hidden) {
            var val = $("#modalInput").value.trim();
            if (!val) { $("#modalError").textContent = "先填内容再确定。"; return; }
            closeModal(val);
        } else {
            closeModal(true);
        }
    });

    function confirmBox(opts) {
        return new Promise(function (resolve) {
            modalResolve = resolve;
            openModal(opts);
        });
    }

    function askInput(opts) {
        return new Promise(function (resolve) {
            modalResolve = resolve;
            openModal(Object.assign({ input: true }, opts));
        });
    }

    /* ---------------- 启动 ---------------- */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initGate);
    } else {
        initGate();
    }
})();
