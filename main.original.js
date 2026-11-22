/* ============================================================
   凌箭航天 SKYARROW — main.js  （功能全开版）
   导航 / 全屏菜单 / 任务弹窗 / 图集灯箱 / 任务档案 / 航天工具
   时间线 / 弹幕广场 / 每日星图 / 测验 / 音效 / 快捷键 / 彩蛋
   ============================================================ */

(function () {
    "use strict";

    /* ==================== 配置 ==================== */

    var CONFIG = {
        countdownTarget: "2026-11-15T09:00:00+08:00",   // 下次模拟任务时间（可改）
        countdownMission: "长征五号B · 问天舱段",
        soundDefault: false                              // 界面音效默认关
    };

    /* ==================== 小工具 ==================== */

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    var store = {
        get: function (k, def) {
            try { var v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); }
            catch (e) { return def; }
        },
        set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };

    var toastEl = $("#toast");
    var toastTimer = null;

    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
    }

    /* ==================== 音效引擎（WebAudio 合成，无音频文件） ==================== */

    var soundOn = store.get("skyarrow_sound", CONFIG.soundDefault);
    var actx = null;

    function beep(freq, dur, type, vol) {
        if (!soundOn) return;
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

    var soundToggle = $("#soundToggle");
    function renderSound() {
        soundToggle.classList.toggle("on", soundOn);
        soundToggle.textContent = soundOn ? "♪" : "♪̸";
        soundToggle.title = soundOn ? "音效：开（P）" : "音效：关（P）";
    }
    soundToggle.addEventListener("click", function () {
        soundOn = !soundOn;
        store.set("skyarrow_sound", soundOn);
        renderSound();
        if (soundOn) beep(880, 0.12, "sine", 0.06);
        toast(soundOn ? "界面音效：已开启" : "界面音效：已关闭");
    });
    renderSound();

    document.addEventListener("click", function (e) {
        if (e.target.closest("button, a, .chip, .arch-card, .quiz-opt")) beep(520, 0.05, "triangle", 0.04);
    });

    /* ==================== 开屏加载 ==================== */

    window.addEventListener("load", function () {
        setTimeout(function () { $("#loader").classList.add("done"); }, 700);
    });
    /* 兜底：极端情况下 4s 后强制消失 */
    setTimeout(function () { $("#loader").classList.add("done"); }, 4000);

    /* ==================== 进度条 / HUD / 返回顶部 / 北京时间 ==================== */

    var progressBar = $("#progress");
    var hud = $("#hud");
    var toTop = $("#toTop");

    var SECTION_LABELS = [
        ["home", "首页"], ["cz7", "长征七号"], ["cz8", "长征八号"],
        ["mammoth", "乳齿象发动机"], ["falcon9", "猎鹰9号"], ["archive", "任务档案"],
        ["tools", "航天工具"], ["timeline", "创作时间线"], ["square", "弹幕广场"], ["about", "关于凌箭"]
    ];

    function tick() {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var y = window.scrollY || doc.scrollTop;
        progressBar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
        toTop.classList.toggle("show", y > 600);

        var idx = 0;
        SECTION_LABELS.forEach(function (s, i) {
            var el = document.getElementById(s[0]);
            if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.45) idx = i;
        });
        var id = SECTION_LABELS[idx][0];
        hud.innerHTML = "<b>" + String(idx + 1).padStart(2, "0") + "</b><span>" + SECTION_LABELS[idx][1] + "</span>";

        $$(".nav-menu a").forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("href") === "#" + id);
        });
        $$(".dots a").forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("data-dot") === id);
        });
    }

    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    tick();

    toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
        beep(700, 0.08, "sine", 0.05);
    });

    setInterval(function () {
        try {
            $("#bjTime").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
        } catch (e) {
            $("#bjTime").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
        }
    }, 1000);

    /* ==================== 全屏菜单 ==================== */

    var burger = $("#navBurger");
    var overlay = $("#menuOverlay");

    function setMenu(open) {
        burger.classList.toggle("open", open);
        overlay.classList.toggle("open", open);
        overlay.setAttribute("aria-hidden", open ? "false" : "true");
        document.body.style.overflow = open ? "hidden" : "";
    }

    burger.addEventListener("click", function () { setMenu(!overlay.classList.contains("open")); });

    /* ==================== 滚动显现 + 数字滚动 ==================== */

    var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (en.isIntersecting) { en.target.classList.add("visible"); revealObserver.unobserve(en.target); }
        });
    }, { threshold: 0.12 });

    $$(".reveal").forEach(function (el) { revealObserver.observe(el); });
    window.observeReveal = function (el) { revealObserver.observe(el); };

    var statObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            var target = parseInt(el.getAttribute("data-count"), 10) || 0;
            var start = null;
            (function step(ts) {
                if (!start) start = ts;
                var p = Math.min((ts - start) / 1600, 1);
                el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
                if (p < 1) requestAnimationFrame(step);
            })();
            statObserver.unobserve(el);
        });
    }, { threshold: 0.5 });

    $$("[data-count]").forEach(function (el) { statObserver.observe(el); });

    /* ==================== 星空粒子（Canvas） ==================== */

    (function starfield() {
        var canvas = $("#starfield");
        if (!canvas) return;
        var ctx = canvas.getContext("2d");
        var stars = [];

        function size() {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            stars = [];
            var n = Math.floor(canvas.width * canvas.height / 9000);
            for (var i = 0; i < n; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    r: Math.random() * 1.4 + 0.3,
                    a: Math.random(),
                    da: (Math.random() * 0.02 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
                    vy: Math.random() * 0.08 + 0.02
                });
            }
        }
        size();
        window.addEventListener("resize", size);

        (function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            stars.forEach(function (s) {
                s.a += s.da;
                if (s.a > 1 || s.a < 0.05) s.da *= -1;
                s.y -= s.vy;
                if (s.y < -2) { s.y = canvas.height + 2; s.x = Math.random() * canvas.width; }
                ctx.globalAlpha = Math.max(0, Math.min(1, s.a)) * 0.9;
                ctx.fillStyle = "#CFEFFF";
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            requestAnimationFrame(draw);
        })();
    })();

    /* ==================== 倒计时 ==================== */

    var cdTarget = new Date(CONFIG.countdownTarget).getTime();

    function tickCountdown() {
        var diff = cdTarget - Date.now();
        if (diff <= 0) {
            $("#cdD").textContent = "0"; $("#cdH").textContent = "0";
            $("#cdM").textContent = "0"; $("#cdS").textContent = "0";
            $(".cd-label").innerHTML = "任务窗口已开启 · <b>" + CONFIG.countdownMission + "</b>";
            return;
        }
        $("#cdD").textContent = Math.floor(diff / 86400000);
        $("#cdH").textContent = Math.floor(diff / 3600000) % 24;
        $("#cdM").textContent = Math.floor(diff / 60000) % 60;
        $("#cdS").textContent = Math.floor(diff / 1000) % 60;
    }
    $("#cdMission").textContent = CONFIG.countdownMission;
    tickCountdown();
    setInterval(tickCountdown, 1000);

    /* ==================== 数据：重点任务 ==================== */

    var MISSIONS = {
        cz7: {
            kicker: "最新任务 · 已圆满成功",
            title: "长征七号 · 天舟夜射",
            desc: "复刻海南文昌夜色中的长征七号点火升空：四座避雷塔间尾焰喷薄、烟雾漫过导流槽，货运飞船踏上约 600 秒的入轨航程。箭体蒙皮、助推器与塔架细节均按真实构型搭建。",
            specs: [
                ["任务代号", "天舟货运飞船发射任务"],
                ["运载火箭", "长征七号（CZ-7）"],
                ["发射场", "文昌航天发射场 · 夜间窗口"],
                ["模拟要素", "点火时序 / 塔架避让 / 抛整流罩"],
                ["使用模拟器", "SFS 航天模拟"]
            ],
            timeline: [
                ["T-0s", "点火，四台主发动机全推力"],
                ["T+10s", "火箭脱离发射塔架"],
                ["T+140s", "助推器分离"],
                ["T+600s", "载荷组合体入轨"]
            ],
            gallery: [
                ["assets/images/real/cz7-main-crop.jpg", "长征七号夜射 · 主图"],
                ["assets/images/real/cz7-hd-1.jpg", "长七任务图 · 一"],
                ["assets/images/real/cz7-hd-2.jpg", "长七任务图 · 二"],
                ["assets/images/real/cz7-hd-3.jpg", "长七任务图 · 三"],
                ["assets/images/real/cz7-hd-4.jpg", "长七任务图 · 四"],
                ["assets/images/real/cz7-hd-5.jpg", "长七任务图 · 五"],
                ["assets/images/real/cz7-hd-6.jpg", "长七任务图 · 六"]
            ]
        },
        cz8: {
            kicker: "可回收构型 · 首飞复刻",
            title: "长征八号 · 首飞任务",
            desc: "新一代中型运载火箭的长征八号首飞任务复刻：垂直总建、转运点火、一二级分离与上面级入轨，为后续可回收构型验证打下基础。",
            specs: [
                ["任务定位", "新一代中型运载火箭首飞"],
                ["构型特点", "芯级捆绑助推 · 可回收化改进基础型"],
                ["发射场", "文昌航天发射场"],
                ["模拟要素", "垂直总装 / 转运 / 首飞全程"],
                ["使用模拟器", "SFS 航天模拟"]
            ],
            gallery: [
                ["assets/images/real/cz8-main-crop.jpg", "长征八号首飞 · 主图"],
                ["assets/images/real/cz8-firstflight-1.jpg", "首飞点火瞬间"],
                ["assets/images/real/cz8-firstflight-2.jpg", "首飞任务 · 备选一"],
                ["assets/images/real/cz8-firstflight-4.jpg", "首飞任务 · 备选二"],
                ["assets/images/real/cz8-cloud-2025.jpg", "长八穿云"],
                ["assets/images/real/cz8-liftoff-2025.jpg", "长八点火升空"]
            ]
        },
        mammoth: {
            kicker: "KSP 专项 · 地面热试车",
            title: "乳齿象发动机 · KS-25x4",
            desc: "坎巴拉动力 Kerbodyne 旗下四喷管巨型液发：单台即可推动最重的上面级组合。专项记录其地面全推力热试车——火焰、热浪与钢架试车台的极限对抗。（图为 KSP 官方部件渲染图）",
            specs: [
                ["部件代号", "S3 KS-25x4 \"Mammoth\""],
                ["厂商", "Kerbodyne（坎巴拉动力）"],
                ["喷管布局", "四喷管并联 · 特大径向尺寸"],
                ["试车内容", "全推力热试车 / 推力曲线记录"],
                ["使用模拟器", "坎巴拉太空计划 KSP"]
            ],
            gallery: [
                ["assets/images/real/ksp-mammoth-quad.png", "乳齿象发动机 · 官方渲染图"]
            ]
        },
        falcon9: {
            kicker: "载人任务 · 全流程演练",
            title: "猎鹰9号 · 载人龙飞船",
            desc: "复现猎鹰9号搭载载人龙飞船的完整任务链：发射逃逸就位、一二级分离、栅格舵展开、一级海上回收，直至龙飞船与空间站交会对接。",
            specs: [
                ["运载火箭", "猎鹰9号（Falcon 9）"],
                ["载人飞船", "龙飞船（Crew Dragon）"],
                ["模拟要素", "分离时序 / 栅格舵 / 一级回收 / 对接"],
                ["任务目标", "载人入轨 · 交会对接"],
                ["使用模拟器", "SFS 航天模拟"]
            ],
            gallery: [
                ["assets/images/real/f9-demo2-2.jpg", "猎鹰9号 · 塔架脱离子夜"],
                ["assets/images/real/banner-f9-crew5-16x9.jpg", "Crew-5 发射 · 横幅"],
                ["assets/images/real/f9-crew5-rc-4.jpg", "Crew-5 遥控机位"],
                ["assets/images/real/f9-dragon-liftoff-2.jpg", "水面倒影夜景"],
                ["assets/images/real/f9-demo2-alt-1.jpg", "Demo-2 · 一"],
                ["assets/images/real/f9-demo2-alt-2.jpg", "Demo-2 · 二"],
                ["assets/images/real/f9-demo2-alt-3.jpg", "Demo-2 · 三"]
            ]
        }
    };

    /* ==================== 数据：任务档案（更多火箭） ==================== */

    var ARCHIVE = [
        { id: "cz7", rocket: "长征", sim: "SFS", status: "done", img: "assets/images/real/cz7-main-crop.jpg", grad: "",
          title: "长征七号 · 天舟夜射", desc: "文昌四塔之间的夜色点火，约 600 秒入轨。" },
        { id: "cz7f", rocket: "长征", sim: "SFS", status: "done", img: "assets/images/real/cz7-firstflight-liftoff.jpg", grad: "",
          title: "长征七号 · 2016 首飞", desc: "首飞任务复刻：新一代中型火箭的处女航。",
          gallery: [
              ["assets/images/real/cz7-firstflight-liftoff.jpg", "2016 首飞 · 点火升空"],
              ["assets/images/real/cz7-firstflight-2.jpg", "2016 首飞 · 任务画面"],
              ["assets/images/real/cz7-hd-1.jpg", "长七任务 · 补充一"],
              ["assets/images/real/cz7-hd-3.jpg", "长七任务 · 补充二"]
          ] },
        { id: "cz8", rocket: "长征", sim: "SFS", status: "done", img: "assets/images/real/cz8-main-crop.jpg", grad: "",
          title: "长征八号 · 首飞复刻", desc: "新一代中型火箭首飞，可回收构型的起点。" },
        { id: "cz8q", rocket: "长征", sim: "SFS", status: "done", img: "assets/images/real/cz8-cloud-2025.jpg", grad: "",
          title: "长征八号 · 千帆组网穿云", desc: "2025 组网发射任务，火箭穿出云层的瞬间。",
          gallery: [
              ["assets/images/real/cz8-cloud-2025.jpg", "长八穿云"],
              ["assets/images/real/cz8-liftoff-2025.jpg", "长八点火升空"]
          ] },
        { id: "falcon9", rocket: "猎鹰", sim: "SFS", status: "done", img: "assets/images/real/f9-demo2-2.jpg", grad: "",
          title: "猎鹰9号 · 载人龙全流程", desc: "从点火到对接的载人任务完整链路。" },
        { id: "f9n", rocket: "猎鹰", sim: "SFS", status: "done", img: "assets/images/real/f9-dragon-liftoff-2.jpg", grad: "",
          title: "猎鹰9号 · 子夜水面倒影", desc: "夜射专项：水面倒影中的九台梅林。",
          gallery: [
              ["assets/images/real/f9-dragon-liftoff-2.jpg", "子夜水面倒影"],
              ["assets/images/real/f9-demo2-alt-1.jpg", "白天发射 · 一"],
              ["assets/images/real/f9-demo2-alt-2.jpg", "白天发射 · 二"],
              ["assets/images/real/f9-demo2-alt-3.jpg", "白天发射 · 三"]
          ] },
        { id: "mammoth", rocket: "KSP", sim: "KSP", status: "done", img: "assets/images/real/ksp-mammoth-quad.png", grad: "",
          title: "乳齿象发动机 · 地面热试车", desc: "四喷管巨兽的全推力试车记录。" },
        { id: "cz5b", rocket: "长征", sim: "SFS", status: "soon", img: "", grad: "arch-soon-1",
          title: "长征五号B · 空间站舱段", desc: "规划中：问天/梦天舱段发射任务复刻。" },
        { id: "cz9", rocket: "长征", sim: "SFS", status: "soon", img: "", grad: "arch-soon-2",
          title: "长征九号 · 重型探月", desc: "规划中：140 吨级重型火箭的探月构型推演。" },
        { id: "fh", rocket: "猎鹰", sim: "SFS", status: "soon", img: "", grad: "arch-soon-3",
          title: "猎鹰重型 · 双侧回收", desc: "规划中：27 台梅林并联与双助推同步着陆。" },
        { id: "starship", rocket: "猎鹰", sim: "KSP", status: "soon", img: "", grad: "arch-soon-4",
          title: "星舰 · 星际基地试飞", desc: "规划中：筷式回收与轨道加注模拟。" },
        { id: "saturn5", rocket: "KSP", sim: "KSP", status: "soon", img: "", grad: "arch-soon-5",
          title: "土星五号 · 阿波罗复刻", desc: "规划中：人类登月 55 周年特别企划。" }
    ];

    /* ==================== 数据：火箭参数库 ==================== */

    var ROCKETS = [
        { name: "长征二号F", nation: "中国", height: 58.34, diameter: 3.35, mass: 480, leo: 8.4, status: "现役" },
        { name: "长征五号", nation: "中国", height: 56.97, diameter: 5.0, mass: 869, leo: 25, status: "现役" },
        { name: "长征七号", nation: "中国", height: 53.1, diameter: 3.35, mass: 597, leo: 13.5, status: "现役" },
        { name: "长征八号", nation: "中国", height: 50.3, diameter: 3.35, mass: 356, leo: 8.4, status: "现役" },
        { name: "长征九号", nation: "中国", height: 93, diameter: 10.0, mass: 4100, leo: 140, status: "研制中" },
        { name: "猎鹰9号", nation: "美国", height: 70, diameter: 3.7, mass: 549, leo: 22.8, status: "现役" },
        { name: "猎鹰重型", nation: "美国", height: 70, diameter: 3.7, mass: 1421, leo: 63.8, status: "现役" },
        { name: "星舰 Starship", nation: "美国", height: 121, diameter: 9.0, mass: 5000, leo: 150, status: "研制中" },
        { name: "SLS Block 1", nation: "美国", height: 98, diameter: 8.4, mass: 2497, leo: 95, status: "现役" },
        { name: "土星五号", nation: "美国", height: 110.6, diameter: 10.1, mass: 2970, leo: 140, status: "退役" },
        { name: "联盟-2.1b", nation: "俄罗斯", height: 46.3, diameter: 2.95, mass: 312, leo: 8.2, status: "现役" }
    ];

    /* ==================== 数据：静态页 & 测验 & 每日星图 ==================== */

    var PAGES = {
        aboutsite: {
            kicker: "ABOUT THIS SITE", title: "关于本站",
            desc: "凌箭航天 SKYARROW 是一名个人航天模拟创作者的官网。写实、克制、硬核——尊重真实的火箭结构与轨道力学，每一帧画面都来自游戏内的亲手搭建。整站由三个文件构成，无需任何框架。",
            specs: [
                ["站点构成", "index.html + style.css + main.js"],
                ["功能模块", "任务档案 / 航天工具箱 / 时间线 / 弹幕广场 / 每日星图 / 测验等 30+ 项"],
                ["视觉基调", "深空藏蓝 · 科技浅青 · 星光银白"],
                ["图片来源", "NASA 图像库 / 中国载人航天 / 航天科技集团 / KSP Wiki / Pexels"],
                ["版权说明", "官方机构图片版权归原单位，仅作学习交流展示"]
            ]
        },
        contact: {
            kicker: "CONTACT", title: "联系方式",
            desc: "想交流航天模拟、合作创作或反馈建议，欢迎通过以下渠道找到凌箭（渠道信息整理中，后续更新）：",
            specs: [
                ["哔哩哔哩", "@凌箭航天 SKYARROW（待补充）"],
                ["抖音", "@凌箭航天（待补充）"],
                ["邮箱", "待补充"],
                ["回复时效", "一般 48 小时内回复"]
            ]
        },
        changelog: {
            kicker: "CHANGELOG", title: "更新日志",
            desc: "本站的成长记录，像火箭一样一级一级往上走。",
            specs: [
                ["v2.0", "任务档案 / 航天工具箱 / 弹幕广场 / 每日星图 / 测验 / 音效 / 快捷键 / 模拟点火彩蛋"],
                ["v1.1", "SpaceX 风格改版：全屏任务分区 + 弹窗 + 灯箱"],
                ["v1.0", "首版上线：首页横幅 + 作品卡片 + 关于页"]
            ]
        }
    };

    var QUIZ = [
        { q: "长征七号火箭的主要任务是什么？", opts: ["运送货运飞船", "载人登月", "发射火星探测器", "亚轨道旅游"], a: 0 },
        { q: "KSP 乳齿象（Mammoth）发动机有几个喷管？", opts: ["1 个", "2 个", "4 个", "9 个"], a: 2 },
        { q: "猎鹰9号一级回收采用什么方式？", opts: ["降落伞溅落", "垂直反推着陆", "机翼滑跑", "直接抛弃"], a: 1 },
        { q: "地球低轨道的圆轨道速度大约是？", opts: ["3.8 km/s", "7.8 km/s", "11.2 km/s", "16.7 km/s"], a: 1 },
        { q: "长征八号的首飞年份是？", opts: ["2016 年", "2018 年", "2020 年", "2022 年"], a: 2 },
        { q: "神舟飞船由哪几部分组成？", opts: ["推进舱·返回舱·轨道舱", "服务舱·气闸舱·实验舱", "整流罩·级间段·尾翼", "乘员舱·货舱·发动机"], a: 0 },
        { q: "「黑障区」发生在飞行哪个阶段？", opts: ["上升段", "再入大气层", "在轨运行", "对接段"], a: 1 },
        { q: "引力弹弓的主要作用是？", opts: ["减速刹车", "借行星动量加速", "产生人工重力", "屏蔽辐射"], a: 1 },
        { q: "KSP 中最经典的引力助推目标通常是？", opts: ["Mun", "Jool 系", "Minmus", "Eve"], a: 1 },
        { q: "空间站绕地球一圈大约需要？", opts: ["90 分钟", "6 小时", "24 小时", "7 天"], a: 0 }
    ];

    var DAILY = [
        ["assets/images/real/bg-milkyway-pexels.jpg", "银河拱桥", "暗夜之中，银河自地平线升起，肉眼可见的恒星约有六千颗。"],
        ["assets/images/real/bg-milkyway-unsplash.jpg", "气泡星云", "哈勃镜头下的恒星风雕塑出的星际气泡。"],
        ["assets/images/real/f9-demo2-2.jpg", "子夜猎鹰", "载人龙飞船乘组出发的深夜，九台梅林点亮海面。"],
        ["assets/images/real/cz7-hd-2.jpg", "文昌夜射", "四座避雷塔之间，长征七号划破夜空。"],
        ["assets/images/real/cz8-cloud-2025.jpg", "穿云的长八", "组网任务中，火箭刺破云层的瞬间。"],
        ["assets/images/real/banner-f9-crew5-16x9.jpg", "Crew-5 启程", "遥控机位记录下白昼发射的蒸汽与尾焰。"],
        ["assets/images/real/f9-crew5-rc-4.jpg", "遥控机位视角", "固定机位见证火箭升空，蒸汽云涌过发射台。"],
        ["assets/images/real/cz8-firstflight-3.jpg", "垂直总建中的长八", "厂房里的国旗与箭体，发射前最安静的时光。"]
    ];

    /* ==================== 弹窗系统 ==================== */

    var modal = $("#modal");
    var modalBody = $("#modalBody");

    var favs = store.get("skyarrow_favs", []);

    function isFav(id) { return favs.indexOf(id) !== -1; }

    function toggleFav(id) {
        var i = favs.indexOf(id);
        if (i === -1) { favs.push(id); toast("已收藏任务 ★"); }
        else { favs.splice(i, 1); toast("已取消收藏"); }
        store.set("skyarrow_favs", favs);
        $$(".arch-card").forEach(function (card) {
            if (card.getAttribute("data-id") === id) {
                var f = card.querySelector(".arch-fav");
                if (f) f.classList.toggle("faved", isFav(id));
            }
        });
        if (currentFilter === "fav") renderArchive();
        if (typeof refreshAch === "function") refreshAch(true);
    }

    function buildPage(data, id) {
        var html = "";
        html += "<p class='m-kicker'>" + (data.kicker || "MISSION") + "</p>";
        html += "<h3 class='m-title'>" + data.title + "</h3>";
        html += "<p class='m-desc'>" + (data.desc || "") + "</p>";
        if (data.specs) {
            html += "<div class='m-specs'>";
            data.specs.forEach(function (row) {
                html += "<div><span>" + row[0] + "</span><b>" + row[1] + "</b></div>";
            });
            html += "</div>";
        }
        if (data.timeline) {
            html += "<p class='m-kicker' style='margin-top:26px'>任务时间线</p><div class='m-specs'>";
            data.timeline.forEach(function (row) {
                html += "<div><span>" + row[0] + "</span><b>" + row[1] + "</b></div>";
            });
            html += "</div>";
        }
        html += "<div class='m-actions'>";
        if (data.gallery && data.gallery.length) {
            html += "<button class='btn-line' data-lightbox='" + id + "'>查看图集</button>";
        }
        html += "<button class='btn-line fav-btn" + (isFav(id) ? " faved" : "") + "' data-fav='" + id + "'>" + (isFav(id) ? "★ 已收藏" : "☆ 收藏") + "</button>";
        html += "<button class='btn-line' data-share='" + (data.title || "凌箭航天 SKYARROW") + "'>分享</button>";
        html += "<button class='btn-line' data-modal-close>关闭</button>";
        html += "</div>";
        return html;
    }

    function resolveData(id) {
        return MISSIONS[id] || PAGES[id] || (function () {
            for (var i = 0; i < ARCHIVE.length; i++) {
                if (ARCHIVE[i].id === id) return buildArchiveData(ARCHIVE[i]);
            }
            return null;
        })();
    }

    function buildArchiveData(item) {
        var data = {
            kicker: item.status === "done" ? "任务档案 · 已完成" : "任务档案 · 筹备中",
            title: item.title,
            desc: item.desc,
            specs: [
                ["火箭系列", item.rocket === "KSP" ? "KSP 部件专项" : item.rocket + "系列"],
                ["模拟器", item.sim === "KSP" ? "坎巴拉太空计划" : "SFS 航天模拟"],
                ["状态", item.status === "done" ? "已完成" : "筹备中"],
                ["收藏", isFav(item.id) ? "已收藏" : "未收藏"]
            ],
            gallery: item.gallery || (item.img ? [[item.img, item.title]] : [])
        };
        if (item.status === "soon") {
            data.desc += "　（该任务正在筹备中，完成上线后会第一时间更新档案与图集。）";
        }
        return data;
    }

    function openModal(id) {
        var data = resolveData(id);
        if (!data) return;
        modalBody.innerHTML = buildPage(data, id);
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        if (!lightbox.classList.contains("open") && !searchModal.classList.contains("open")) {
            document.body.style.overflow = "";
        }
    }

    /* ---- 测验 ---- */

    var quizIdx = 0, quizScore = 0;

    function openQuiz() {
        quizIdx = 0; quizScore = 0;
        renderQuiz();
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function renderQuiz() {
        if (quizIdx >= QUIZ.length) {
            var qBest = store.get("skyarrow_quiz_best", 0);
            if (quizScore > qBest) store.set("skyarrow_quiz_best", quizScore);
            refreshAch(true);
            modalBody.innerHTML =
                "<p class='m-kicker'>QUIZ RESULT</p>" +
                "<h3 class='m-title'>测验完成</h3>" +
                "<p class='quiz-score'>得分：" + quizScore + " / " + QUIZ.length + "</p>" +
                "<p class='m-desc'>" + (quizScore >= 8 ? "航天知识扎实，可以去 KSP 当总师了！" : quizScore >= 5 ? "基础不错，再来一次冲击满分！" : "继续加油，凌箭和你一起补课。") + "</p>" +
                "<div class='m-actions'>" +
                "<button class='btn-line' data-quiz-again='1'>再来一次</button>" +
                "<button class='btn-line' data-modal-close>关闭</button></div>";
            return;
        }
        var q = QUIZ[quizIdx];
        var html = "<p class='m-kicker'>QUIZ · " + (quizIdx + 1) + "/" + QUIZ.length + "</p>" +
            "<h3 class='m-title'>航天小测验</h3>" +
            "<p class='quiz-q'>" + q.q + "</p><div class='quiz-opts'>";
        q.opts.forEach(function (opt, i) {
            html += "<button class='quiz-opt' data-opt='" + i + "'>" + String.fromCharCode(65 + i) + ". " + opt + "</button>";
        });
        html += "</div>";
        modalBody.innerHTML = html;
    }

    /* ==================== 图集灯箱 ==================== */

    var lightbox = $("#lightbox");
    var lbImg = $("#lbImg");
    var lbCap = $("#lbCap");
    var lbNum = $("#lbNum");
    var lbDl = $("#lbDl");
    var lbList = [];
    var lbIndex = 0;

    function showLb(i) {
        lbIndex = (i + lbList.length) % lbList.length;
        var item = lbList[lbIndex];
        lbImg.src = item[0];
        lbImg.alt = item[1];
        lbCap.textContent = item[1];
        lbNum.textContent = (lbIndex + 1) + " / " + lbList.length;
        lbDl.href = item[0];
    }

    function openLightboxList(list) {
        if (!list || !list.length) { toast("该任务图集筹备中"); return; }
        lbList = list;
        showLb(0);
        lightbox.classList.add("open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function openLightbox(id) {
        var data = resolveData(id);
        openLightboxList(data && data.gallery);
    }

    function closeLightbox() {
        lightbox.classList.remove("open");
        lightbox.setAttribute("aria-hidden", "true");
        if (!modal.classList.contains("open") && !searchModal.classList.contains("open")) {
            document.body.style.overflow = "";
        }
    }

    $("#lbPrev").addEventListener("click", function () { showLb(lbIndex - 1); });
    $("#lbNext").addEventListener("click", function () { showLb(lbIndex + 1); });

    /* ==================== 搜索弹窗 ==================== */

    var searchModal = $("#searchModal");
    var globalSearch = $("#globalSearch");
    var searchHits = $("#searchHits");

    function openSearch() {
        searchModal.classList.add("open");
        searchModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        setTimeout(function () { globalSearch.focus(); }, 120);
    }

    function closeSearch() {
        searchModal.classList.remove("open");
        searchModal.setAttribute("aria-hidden", "true");
        if (!modal.classList.contains("open") && !lightbox.classList.contains("open")) {
            document.body.style.overflow = "";
        }
    }

    function doGlobalSearch(kw) {
        kw = kw.trim().toLowerCase();
        searchHits.innerHTML = "";
        if (!kw) return;
        var pool = [];
        ARCHIVE.forEach(function (a) {
            if ((a.title + a.rocket + a.sim).toLowerCase().indexOf(kw) !== -1) {
                pool.push({ id: a.id, title: a.title, tag: a.status === "done" ? "已完成" : "筹备中" });
            }
        });
        Object.keys(MISSIONS).forEach(function (k) {
            if (MISSIONS[k].title.toLowerCase().indexOf(kw) !== -1 && !pool.some(function (p) { return p.id === k; })) {
                pool.push({ id: k, title: MISSIONS[k].title, tag: "重点任务" });
            }
        });
        if (!pool.length) {
            searchHits.innerHTML = "<p class='db-empty'>没有找到相关任务，换个关键词试试。</p>";
            return;
        }
        pool.slice(0, 8).forEach(function (p) {
            var b = document.createElement("button");
            b.className = "hit";
            b.innerHTML = "<span>" + p.title + "</span><em>" + p.tag + "</em>";
            b.addEventListener("click", function () {
                closeSearch();
                setTimeout(function () { openModal(p.id); }, 140);
            });
            searchHits.appendChild(b);
        });
    }

    globalSearch.addEventListener("input", function () { doGlobalSearch(globalSearch.value); });
    globalSearch.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            var first = searchHits.querySelector(".hit");
            if (first) first.click();
        }
    });
    $("#searchBtn").addEventListener("click", openSearch);

    /* ==================== 任务档案渲染 ==================== */

    var currentFilter = "all";
    var archGrid = $("#archGrid");
    var archSearch = $("#archSearch");

    function renderArchive() {
        var kw = archSearch.value.trim().toLowerCase();
        archGrid.innerHTML = "";
        ARCHIVE.forEach(function (a) {
            /* 筛选 */
            if (currentFilter === "fav" && !isFav(a.id)) return;
            if (currentFilter === "done" && a.status !== "done") return;
            if (currentFilter === "soon" && a.status !== "soon") return;
            if (["长征", "猎鹰", "KSP"].indexOf(currentFilter) !== -1 && a.rocket !== currentFilter) return;
            /* 搜索 */
            if (kw && (a.title + a.rocket + a.sim + a.desc).toLowerCase().indexOf(kw) === -1) return;

            var card = document.createElement("article");
            card.className = "arch-card";
            card.setAttribute("data-id", a.id);

            var media;
            if (a.img) {
                media = "<div class='arch-media'><img src='" + a.img + "' alt='" + a.title + "' loading='lazy'></div>";
            } else {
                media = "<div class='arch-media arch-media--soon " + a.grad + "'>🚀</div>";
            }

            card.innerHTML =
                media +
                "<span class='arch-status " + (a.status === "done" ? "st-done" : "st-soon") + "'>" +
                (a.status === "done" ? "已完成" : "筹备中") + "</span>" +
                "<button class='arch-fav" + (isFav(a.id) ? " faved" : "") + "' data-fav='" + a.id + "' title='收藏'>★</button>" +
                "<div class='arch-body'><h3>" + a.title + "</h3><p>" + a.desc + "</p>" +
                "<div class='arch-tags'><span>" + (a.sim === "KSP" ? "KSP 模拟" : "SFS 模拟") + "</span><span>" +
                (a.rocket === "KSP" ? "部件专项" : a.rocket + "系列") + "</span></div></div>";

            archGrid.appendChild(card);
            window.observeReveal(card);
        });

        if (!archGrid.children.length) {
            archGrid.innerHTML = "<p class='db-empty'>没有匹配的任务。试试清空筛选条件？</p>";
        }
    }

    $("#archFilters").addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (!chip) return;
        $$("#archFilters .chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        currentFilter = chip.getAttribute("data-f");
        renderArchive();
    });

    archSearch.addEventListener("input", renderArchive);

    renderArchive();

    /* ==================== 轨道计算器 ==================== */

    function calcOrbit() {
        var alt = parseFloat($("#orbitAlt").value);
        if (isNaN(alt) || alt < 0) { toast("请输入正确的轨道高度"); return; }
        var mu = 398600.4418;               // km^3/s^2
        var r = 6371 + alt;                 // km
        var v = Math.sqrt(mu / r);          // km/s
        var T = 2 * Math.PI * Math.sqrt(r * r * r / mu) / 60;  // min
        var out = $("#orbitOut");
        out.innerHTML =
            "<div><span>轨道半径</span><b>" + r.toFixed(0) + " km</b></div>" +
            "<div><span>轨道速度</span><b>" + v.toFixed(2) + " km/s</b></div>" +
            "<div><span>轨道周期</span><b>" + T.toFixed(1) + " min</b></div>";
        toast("轨道计算完成");
    }
    $("#orbitGo").addEventListener("click", calcOrbit);
    $("#orbitAlt").addEventListener("keydown", function (e) { if (e.key === "Enter") calcOrbit(); });
    calcOrbit();

    /* ==================== 火箭参数库 ==================== */

    var dbBody = $("#dbBody");
    var dbSearch = $("#dbSearch");
    var dbSort = { key: "name", dir: 1 };

    function renderDB() {
        var kw = dbSearch.value.trim().toLowerCase();
        var rows = ROCKETS.filter(function (r) {
            return !kw || (r.name + r.nation + r.status).toLowerCase().indexOf(kw) !== -1;
        });
        rows.sort(function (a, b) {
            var x = a[dbSort.key], y = b[dbSort.key];
            if (typeof x === "string") return x.localeCompare(y) * dbSort.dir;
            return (x - y) * dbSort.dir;
        });
        dbBody.innerHTML = rows.map(function (r) {
            return "<tr><td><b>" + r.name + "</b></td><td>" + r.nation + "</td><td>" + r.height +
                "</td><td>" + r.diameter + "</td><td>" + r.mass + "</td><td>" + r.leo + "</td><td>" + r.status + "</td></tr>";
        }).join("") || "<tr><td colspan='7' class='db-empty'>没有匹配的火箭。</td></tr>";

        $$("#dbTable th").forEach(function (th) {
            th.classList.toggle("sorted", th.getAttribute("data-key") === dbSort.key);
        });
    }

    $("#dbTable").addEventListener("click", function (e) {
        var th = e.target.closest("th[data-key]");
        if (!th) return;
        var key = th.getAttribute("data-key");
        if (dbSort.key === key) dbSort.dir *= -1; else { dbSort.key = key; dbSort.dir = 1; }
        renderDB();
        beep(600, 0.05, "sine", 0.04);
    });

    dbSearch.addEventListener("input", renderDB);
    renderDB();

    /* ==================== 火箭对比 ==================== */

    var cmpA = $("#cmpA"), cmpB = $("#cmpB");

    ROCKETS.forEach(function (r, i) {
        cmpA.add(new Option(r.name, i));
        cmpB.add(new Option(r.name, i));
    });
    cmpA.value = "0"; cmpB.value = "5";

    $("#cmpGo").addEventListener("click", function () {
        var a = ROCKETS[+cmpA.value], b = ROCKETS[+cmpB.value];
        var keys = [
            ["name", "火箭"], ["nation", "国家"], ["height", "高度 (m)"],
            ["diameter", "直径 (m)"], ["mass", "起飞质量 (t)"], ["leo", "LEO 运力 (t)"], ["status", "状态"]
        ];
        var html = "";
        html += "<div class='cmp-row cmp-head'><span>参数</span><span>" + a.name + "</span><span>" + b.name + "</span></div>";
        keys.forEach(function (k) {
            var va = a[k[0]], vb = b[k[0]];
            var ha = "", hb = "";
            if (typeof va === "number" && typeof vb === "number") {
                ha = va > vb ? " hi" : ""; hb = vb > va ? " hi" : "";
            }
            html += "<div class='cmp-row'><span class='k'>" + k[1] + "</span><span class='v" + ha + "'>" + va +
                "</span><span class='v" + hb + "'>" + vb + "</span></div>";
        });
        $("#cmpOut").innerHTML = html;
        toast("对比完成，优势项已高亮");
    });

    /* ==================== 弹幕广场 ==================== */

    var dmStage = $("#dmStage");
    var dmInput = $("#dmInput");
    var dmKey = "skyarrow_danmaku";

    function flyDanmaku(text, dur) {
        var s = document.createElement("span");
        s.className = "dm-item";
        s.textContent = text;
        s.style.top = (8 + Math.random() * 70) + "%";
        s.style.right = "-420px";
        s.style.animationDuration = (dur || 7 + Math.random() * 4) + "s";
        dmStage.appendChild(s);
        s.addEventListener("animationend", function () { s.remove(); });
        var hint = $("#dmHint");
        if (hint) hint.style.display = "none";
    }

    function sendDanmaku() {
        var t = dmInput.value.trim();
        if (!t) { toast("先写点什么再发射吧"); return; }
        var list = store.get(dmKey, []);
        list.unshift({ t: t, d: new Date().toLocaleString("zh-CN", { hour12: false }) });
        store.set(dmKey, list.slice(0, 100));
        flyDanmaku(t);
        dmInput.value = "";
        toast("弹幕已发射，已保存在本机");
        refreshAch(true);
    }

    $("#dmSend").addEventListener("click", sendDanmaku);
    dmInput.addEventListener("keydown", function (e) { if (e.key === "Enter") sendDanmaku(); });

    $("#dmReplay").addEventListener("click", function () {
        var list = store.get(dmKey, []);
        if (!list.length) { toast("本机还没有弹幕记录"); return; }
        toast("回放 " + list.length + " 条弹幕");
        list.forEach(function (m, i) {
            setTimeout(function () { flyDanmaku(m.t, 8); }, i * 900);
        });
    });

    $("#dmClear").addEventListener("click", function () {
        store.set(dmKey, []);
        dmStage.innerHTML = "<p class='dm-hint' id='dmHint'>发射一条弹幕试试 →</p>";
        toast("弹幕记录已清空");
    });

    /* ==================== 每日星图 ==================== */

    var dayIndex = Math.floor((Date.now() - new Date(2026, 0, 1).getTime()) / 86400000) % DAILY.length;

    function renderDaily(i) {
        var d = DAILY[(i + DAILY.length) % DAILY.length];
        $("#dailyImg").src = d[0];
        $("#dailyImg").alt = d[1];
        $("#dailyTitle").textContent = d[1];
        $("#dailyDesc").textContent = d[2];
    }
    renderDaily(dayIndex);

    $("#dailyNext").addEventListener("click", function () {
        dayIndex = (dayIndex + 1 + Math.floor(Math.random() * (DAILY.length - 1))) % DAILY.length;
        renderDaily(dayIndex);
    });

    $("#dailyBig").addEventListener("click", function () {
        var d = DAILY[(dayIndex + DAILY.length) % DAILY.length];
        openLightboxList([[d[0], d[1]]]);
    });

    /* ==================== 模拟点火彩蛋 ==================== */

    $("#launchEgg").addEventListener("click", function () {
        var egg = $("#egg");
        egg.classList.add("go");
        beep(180, 0.5, "sawtooth", 0.06);
        setTimeout(function () { beep(120, 0.9, "sawtooth", 0.05); }, 200);
        setTimeout(function () {
            egg.classList.remove("go");
            toast("点火成功，凌箭升空！🚀");
        }, 2500);
    });

    /* ==================== 分享 ==================== */

    function doShare(text) {
        var full = "凌箭航天 SKYARROW · " + text + " · " + location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(full).then(function () { toast("分享文案已复制"); },
                function () { fallbackCopy(full); });
        } else {
            fallbackCopy(full);
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); toast("分享文案已复制"); }
        catch (e) { toast("复制失败，请手动复制"); }
        ta.remove();
    }

    /* ==================== 全局事件委托 ==================== */

    document.addEventListener("click", function (e) {
        /* 全屏菜单内链接 */
        if (e.target.closest("[data-close]")) setMenu(false);

        /* 弹窗打开 */
        var mBtn = e.target.closest("[data-modal]");
        if (mBtn) { openModal(mBtn.getAttribute("data-modal")); return; }

        /* 灯箱 */
        var lbBtn = e.target.closest("[data-lightbox]");
        if (lbBtn) {
            closeModal();
            setTimeout(function () { openLightbox(lbBtn.getAttribute("data-lightbox")); }, 120);
            return;
        }

        /* 收藏 */
        var favBtn = e.target.closest("[data-fav]");
        if (favBtn) {
            e.stopPropagation();
            toggleFav(favBtn.getAttribute("data-fav"));
            if (favBtn.classList.contains("fav-btn")) {
                favBtn.classList.toggle("faved", isFav(favBtn.getAttribute("data-fav")));
                favBtn.textContent = isFav(favBtn.getAttribute("data-fav")) ? "★ 已收藏" : "☆ 收藏";
            }
            return;
        }

        /* 分享 */
        var shBtn = e.target.closest("[data-share]");
        if (shBtn) { doShare(shBtn.getAttribute("data-share")); return; }

        /* 测验 */
        if (e.target.closest("[data-quiz]")) { closeModal(); setTimeout(openQuiz, 120); return; }
        if (e.target.closest("[data-quiz-again]")) { openQuiz(); return; }

        var opt = e.target.closest(".quiz-opt");
        if (opt) {
            var q = QUIZ[quizIdx];
            var pick = +opt.getAttribute("data-opt");
            $$(".quiz-opt", modalBody).forEach(function (b) {
                var bi = +b.getAttribute("data-opt");
                if (bi === q.a) b.classList.add("correct");
                else if (bi === pick) b.classList.add("wrong");
            });
            if (pick === q.a) { quizScore++; beep(880, 0.12, "sine", 0.06); }
            else beep(220, 0.2, "square", 0.05);
            quizIdx++;
            setTimeout(renderQuiz, 900);
            return;
        }

        /* 关闭类 */
        if (e.target.closest("[data-modal-close]")) closeModal();
        if (e.target.closest("[data-lb-close]")) closeLightbox();
        if (e.target.closest("[data-sm-close]")) closeSearch();

        /* 档案卡片：打开详情（点收藏按钮时不触发） */
        var card = e.target.closest(".arch-card");
        if (card && !e.target.closest("[data-fav]")) {
            openModal(card.getAttribute("data-id"));
        }
    });

    /* ================================================================
       v3.0 航天实验室（10 组计算工具）
       ================================================================ */

    var BODIES = [
        ["月球", "🌙", 1.62, 27.3, 2.38], ["水星", "🌑", 3.70, 88, 4.25],
        ["金星", "🌕", 8.87, 224.7, 10.36], ["地球", "🌍", 9.81, 365.25, 11.19],
        ["火星", "🔴", 3.71, 687, 5.03], ["木星", "🪐", 24.79, 4333, 59.5],
        ["土星", "🪐", 10.44, 10759, 35.5], ["天王星", "🔵", 8.87, 30687, 21.3],
        ["海王星", "🔵", 11.15, 60190, 23.5], ["太阳", "☀️", 274, 0, 617.5],
        ["冥王星", "🌑", 0.62, 90560, 1.21]
    ];

    function bodyOptions(sel) {
        var i = sel || 3;
        return BODIES.map(function (b, ix) {
            return "<option value='" + ix + "'" + (ix === i ? " selected" : "") + ">" + b[0] + "</option>";
        }).join("");
    }

    var LABS = [
        {
            t: "🌍 重力体重换算", tip: "同一质量，在不同天体上「重量」不同",
            h: "<div class='tool-row'><input type='number' id='labW' value='60' min='1'> <span class='tool-unit'>kg</span>" +
               "<select id='labWb'>" + bodyOptions(3) + "</select></div>",
            r: function () {
                var w = parseFloat($("#labW").value), b = BODIES[+$("#labWb").value];
                if (!(w > 0)) return "请输入有效体重";
                return "在<b>" + b[0] + "</b>上重约 <b>" + (w * b[2] / 9.81).toFixed(1) + " kgf</b><br><span class='dim'>表面重力 " + b[2] + " m/s²（地球 = 9.81）</span>";
            }
        },
        {
            t: "🎂 行星年龄计算", tip: "公转周期不同，你的「行星岁数」也不同",
            h: "<div class='tool-row'><input type='number' id='labA' value='16' min='1' max='200'> <span class='tool-unit'>岁</span>" +
               "<select id='labAb'>" + bodyOptions(5) + "</select></div>",
            r: function () {
                var a = parseFloat($("#labA").value), b = BODIES[+$("#labAb").value];
                if (!(a > 0) || !b[3]) return "请输入有效年龄";
                var v = a * 365.25 / b[3];
                return "地球 " + a + " 岁 ≈ <b>" + b[0] + "上的 " + (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + " 岁</b><br><span class='dim'>公转周期 " + (b[3] >= 365 ? (b[3] / 365.25).toFixed(2) + " 地球年" : b[3] + " 地球天") + "</span>";
            }
        },
        {
            t: "💡 光速旅行时间", tip: "以光速出发，到达目的地要多久",
            h: "<div class='tool-row'><select id='labL'>" +
               "<option value='384400'>月球 · 38.4 万 km</option><option value='225000000' selected>火星 · 平均 2.25 亿 km</option>" +
               "<option value='149600000'>太阳 · 1.496 亿 km</option><option value='778500000'>木星 · 7.79 亿 km</option>" +
               "<option value='4500000000'>海王星 · 45 亿 km</option><option value='40130000000000'>比邻星 · 4.24 光年</option></select></div>",
            r: function () {
                var d = +$("#labL").value, s = d / 299792.458;
                var txt = s < 120 ? s.toFixed(2) + " 秒" : s < 7200 ? (s / 60).toFixed(1) + " 分钟" :
                    s < 172800 ? (s / 3600).toFixed(1) + " 小时" : s < 3.15e7 ? (s / 86400).toFixed(1) + " 天" : (s / 3.156e7).toFixed(2) + " 年";
                return "光需要 <b>" + txt + "</b> 抵达<br><span class='dim'>以现役火箭速度约需 " + (s / 0.0000165).toFixed(0) + " 秒 ×4000 倍光速比想象更远</span>";
            }
        },
        {
            t: "🚀 Δv 火箭方程", tip: "齐奥尔科夫斯基公式 Δv = ve·ln(m0/m1)",
            h: "<div class='tool-row'><input type='number' id='labM0' value='500' placeholder='起飞质量 t'><input type='number' id='labM1' value='120' placeholder='干质量 t'><input type='number' id='labVe' value='3.4' step='0.1' placeholder='喷速 km/s'></div>",
            r: function () {
                var m0 = +$("#labM0").value, m1 = +$("#labM1").value, ve = +$("#labVe").value;
                if (!(m0 > m1 && m1 > 0 && ve > 0)) return "需要 m0 &gt; m1 &gt; 0 且喷速 &gt; 0";
                var dv = ve * Math.log(m0 / m1);
                return "理想 Δv ≈ <b>" + dv.toFixed(2) + " km/s</b><br><span class='dim'>质量比 " + (m0 / m1).toFixed(2) + " · 参考：LEO 需 9.4，逃逸地球需 12.6（含损耗）</span>";
            }
        },
        {
            t: "⛽ 燃料质量比", tip: "想获得目标 Δv，火箭多重是燃料",
            h: "<div class='tool-row'><input type='number' id='labDv' value='9.4' step='0.1' placeholder='目标 Δv km/s'><input type='number' id='labVe2' value='3.4' step='0.1' placeholder='喷速 km/s'></div>",
            r: function () {
                var dv = +$("#labDv").value, ve = +$("#labVe2").value;
                if (!(dv > 0 && ve > 0)) return "请输入有效数值";
                var ratio = Math.exp(dv / ve), pct = (1 - 1 / ratio) * 100;
                return "所需质量比 ≈ <b>" + ratio.toFixed(2) + "</b><br><span class='dim'>燃料约占总质量的 <b>" + pct.toFixed(1) + "%</b>（真实火箭 85~95%）</span>";
            }
        },
        {
            t: "📐 万能单位换算", tip: "航天常用的三组换算，一键全出",
            h: "<div class='tool-row'><input type='number' id='labKm' value='400' placeholder='公里'><input type='number' id='labKg' value='500' placeholder='公斤'><input type='number' id='labC' value='25' placeholder='摄氏 °C'></div>",
            r: function () {
                var km = +$("#labKm").value || 0, kg = +$("#labKg").value || 0, c = +$("#labC").value || 0;
                return "<b>" + km + " km</b> = " + (km * 0.621371).toFixed(1) + " mi = " + (km * 1000).toLocaleString() + " m<br>" +
                    "<b>" + kg + " kg</b> = " + (kg * 2.20462).toFixed(1) + " lb = " + (kg / 1000).toFixed(2) + " t<br>" +
                    "<b>" + c + " °C</b> = " + (c * 9 / 5 + 32).toFixed(1) + " °F = " + (c + 273.15).toFixed(1) + " K";
            }
        },
        {
            t: "🛫 逃逸速度查询", tip: "挣脱天体引力所需的最小速度",
            h: "<div class='tool-row'><select id='labEb'>" + bodyOptions(3) + "</select></div>",
            r: function () {
                var b = BODIES[+$("#labEb").value];
                return "<b>" + b[0] + "</b> 的逃逸速度为 <b>" + b[4] + " km/s</b><br><span class='dim'>约为地球（11.19 km/s）的 " + (b[4] / 11.19 * 100).toFixed(0) + "%</span>";
            }
        },
        {
            t: "🛰 圆轨道速度表", tip: "不同高度圆轨道所需速度（μ=398600）",
            h: "<div class='tool-row'><button class='btn-line' data-lab-run='vt'>生成速度表</button></div>",
            r: function () {
                var rows = [200, 300, 400, 600, 1000, 2000, 5000, 10000, 35786], out = "";
                rows.forEach(function (h) {
                    var v = Math.sqrt(398600.4418 / (6371 + h));
                    out += "<div class='lab-bar'><i style='width:" + (v / 8).toFixed(0) + "%'></i></div>" + h.toLocaleString() + " km → <b>" + v.toFixed(2) + " km/s</b><br>";
                });
                return out + "<span class='dim'>35786 km 即地球同步轨道，周期 24h</span>";
            }
        },
        {
            t: "📊 运力对比图", tip: "11 枚火箭 LEO 运力可视化",
            h: "<div class='tool-row'><button class='btn-line' data-lab-run='bars'>生成条形图</button></div>",
            r: function () {
                var max = Math.max.apply(null, ROCKETS.map(function (r) { return r.leo; }));
                return ROCKETS.map(function (r) {
                    return "<div class='lab-bar'><i style='width:" + (r.leo / max * 100).toFixed(1) + "%'></i></div>" + r.name + " → <b>" + r.leo + " t</b>";
                }).join("<br>");
            }
        },
        {
            t: "📅 发射窗口日历", tip: "凌箭模拟任务排期（持续更新）",
            h: "<div class='tool-row'><button class='btn-line' data-lab-run='win'>查看排期</button></div>",
            r: function () {
                var win = [
                    ["2026-11-15", "长征五号B · 问天舱段（模拟）"],
                    ["2026-12-02", "天舟货运 · 夜射窗口（模拟）"],
                    ["2026-12-24", "猎鹰9号 · 第 N 次复飞（模拟）"],
                    ["2027-01-08", "乳齿象 · 全推力试车复刻（KSP）"],
                    ["2027-02-17", "长八甲 · 一箭多星（模拟）"],
                    ["2027-03-05", "载人龙 · 换乘演练（模拟）"]
                ];
                return win.map(function (w) { return "<b>" + w[0] + "</b> · " + w[1]; }).join("<br>") +
                    "<br><span class='dim'>窗口受轨道倾角与光照约束，模拟排期仅供参考</span>";
            }
        }
    ];

    function renderLab() {
        var grid = $("#labGrid");
        if (!grid) return;
        grid.innerHTML = LABS.map(function (l, i) {
            return "<div class='lab-card tool-card reveal' data-lab='" + i + "'><h3>" + l.t + "</h3><p class='tool-tip'>" + l.tip + "</p>" + l.h + "<div class='lab-out'></div></div>";
        }).join("");
        $$(".lab-card", grid).forEach(function (c) { window.observeReveal(c); });
        runLabAll();
    }

    function runLabCard(card) {
        var i = +card.getAttribute("data-lab"), out = card.querySelector(".lab-out");
        if (!out) return;
        try { out.innerHTML = LABS[i].r(); } catch (e) { out.innerHTML = "计算出错"; }
    }

    function runLabAll() { $$(".lab-card").forEach(runLabCard); }

    $("#labGrid").addEventListener("input", function (e) {
        var card = e.target.closest(".lab-card");
        if (card) runLabCard(card);
    });
    $("#labGrid").addEventListener("click", function (e) {
        if (!e.target.closest("[data-lab-run]")) return;
        var card = e.target.closest(".lab-card");
        if (card) { runLabCard(card); beep(700, 0.05, "sine", 0.04); }
    });
    $("#labGrid").addEventListener("change", function (e) {
        var card = e.target.closest(".lab-card");
        if (card) runLabCard(card);
    });
    renderLab();

    /* ================================================================
       v3.0 观星台：月相 / 星座 / 太阳系 / 流星雨
       ================================================================ */

    var MOON_NAMES = ["新月", "娥眉月", "上弦月", "盈凸月", "满月", "亏凸月", "下弦月", "残月"];
    var MOON_EMOJI = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

    function moonPhase(date) {
        var ref = Date.UTC(2000, 0, 6, 18, 14);
        var days = (date.getTime() - ref) / 86400000;
        var p = (days % 29.530588853 + 29.530588853) % 29.530588853 / 29.530588853;
        return p;
    }

    function renderMoon(date) {
        var p = moonPhase(date);
        var idx = Math.round(p * 8) % 8;
        var illum = (1 - Math.cos(2 * Math.PI * p)) / 2 * 100;
        var dstr = date.toLocaleDateString("zh-CN", { month: "long", day: "numeric", year: "numeric" });
        $("#moonBox").innerHTML =
            "<div class='moon-emoji'>" + MOON_EMOJI[idx] + "</div>" +
            "<div class='moon-info'><h3>今晚月相 · " + MOON_NAMES[idx] + "</h3>" +
            "<p>" + dstr + " · 照亮面积 <b>" + illum.toFixed(1) + "%</b></p>" +
            "<p>月龄 <b>" + (p * 29.53).toFixed(1) + " 天</b> · 平均朔望月 29.53 天</p></div>" +
            "<div class='moon-date'><input type='date' id='moonDate' value='" + date.toISOString().slice(0, 10) + "'>" +
            "<button class='btn-line' id='moonGo'>查那天</button></div>";
        $("#moonGo").addEventListener("click", function () {
            var v = $("#moonDate").value;
            if (!v) { toast("先选一个日期"); return; }
            renderMoon(new Date(v + "T12:00:00+08:00"));
            toast("已查询 " + v + " 的月相");
        });
    }
    renderMoon(new Date());

    var CONSTS = [
        ["🌌", "猎户座", "ORION", "冬季最壮丽的星座，腰带三星连成一线，参宿四是红超巨星。", "冬季 · 天赤道"],
        ["🐻", "大熊座", "URSA MAJOR", "北斗七星所在。斗口两星连线延长五倍即找到北极星。", "全年可见（北半球）"],
        ["👑", "仙后座", "CASSIOPEIA", "显著的「W」形，与北斗隔北极星相望，是找极星的另一把钥匙。", "全年可见（北天）"],
        ["🦢", "天鹅座", "CYGNUS", "夏夜大三角之一，横跨银河，天津四是天鹅尾羽。", "夏季 · 北天"],
        ["🦂", "天蝎座", "SCORPIUS", "心宿二火红如火星，夏季南部夜空的巨大钩形。", "夏季 · 南天"],
        ["🦁", "狮子座", "LEO", "春季代表星座，轩辕十四是黄道上最亮的星之一。", "春季 · 黄道"],
        ["🎼", "天琴座", "LYRA", "织女星所在，夏季大三角最亮一角，有天琴座流星雨。", "夏季 · 北天"],
        ["✝️", "南十字座", "CRUX", "南半球的「指路星座」，十字长轴延长约 4.5 倍指向南天极。", "南半球全年"]
    ];

    var PLANETS = [
        ["☀️", "太阳", "SUN", "1392000", "—", "25~35 天", "—", "直径 139.2 万 km，占太阳系总质量 99.86%。"],
        ["🌑", "水星", "MERCURY", "4879", "5790 万 km", "176 天", "88 天", "0", "最小也最靠近太阳，昼夜温差 600℃。"],
        ["🌕", "金星", "VENUS", "12104", "1.08 亿 km", "243 天", "225 天", "0", "浓硫酸云包裹，地表 465℃，比水星更热。"],
        ["🌍", "地球", "EARTH", "12742", "1.496 亿 km", "24 小时", "365 天", "1", "目前已知唯一存在生命的行星。"],
        ["🌙", "月球", "MOON", "3475", "38.4 万 km", "27.3 天", "27.3 天", "—", "潮汐锁定，永远以同一面朝向地球。"],
        ["🔴", "火星", "MARS", "6779", "2.28 亿 km", "24.6 小时", "687 天", "2", "奥林帕斯山高 22 km，太阳系第一高峰。"],
        ["🪐", "木星", "JUPITER", "139820", "7.79 亿 km", "9.9 小时", "11.9 年", "95", "大红斑风暴已持续 350 余年。"],
        ["🪐", "土星", "SATURN", "116460", "14.3 亿 km", "10.7 小时", "29.5 年", "146", "环系直径 28 万 km，厚仅约 10 m 量级。"],
        ["🔵", "天王星", "URANUS", "50724", "28.7 亿 km", "17.2 小时", "84 年", "28", "躺着自转，倾角约 98°。"],
        ["🔵", "海王星", "NEPTUNE", "49244", "45 亿 km", "16.1 小时", "165 年", "16", "风速可达 2100 km/h，太阳系最强。"]
    ];

    function renderSkyCards() {
        var cg = $("#constGrid"), pg = $("#planetGrid");
        if (!cg || !pg) return;
        cg.innerHTML = CONSTS.map(function (c, i) {
            return "<button class='sky-card' data-const='" + i + "'><span class='sc-emoji'>" + c[0] + "</span><b>" + c[1] + "</b><em>" + c[2] + "</em><p>最佳观赏：" + c[4] + "</p></button>";
        }).join("");
        pg.innerHTML = PLANETS.map(function (p, i) {
            return "<button class='sky-card' data-planet='" + i + "'><span class='sc-emoji'>" + p[0] + "</span><b>" + p[1] + "</b><em>" + p[2] + "</em><p>直径 " + p[3] + " km · 卫星 " + p[7] + "</p></button>";
        }).join("");
        window.observeReveal(cg); window.observeReveal(pg);
    }
    renderSkyCards();

    var METEORS = [
        ["象限仪座流星雨", "1 月 3-4 日", 110, "牧夫座", "小行星 2003 EH1"],
        ["天琴座流星雨", "4 月 22-23 日", 18, "天琴座", "C/1861 G1"],
        ["宝瓶座η流星雨", "5 月 5-6 日", 50, "宝瓶座", "哈雷彗星"],
        ["英仙座流星雨", "8 月 12-13 日", 100, "英仙座", "斯威夫特-塔特尔"],
        ["天龙座流星雨", "10 月 8-9 日", 10, "天龙座", "贾科比尼-津纳"],
        ["猎户座流星雨", "10 月 21-22 日", 20, "猎户座", "哈雷彗星"],
        ["南金牛座流星雨", "11 月 5-6 日", 7, "金牛座", "恩克彗星"],
        ["狮子座流星雨", "11 月 17-18 日", 15, "狮子座", "坦普尔-塔特尔"],
        ["双子座流星雨", "12 月 13-14 日", 150, "双子座", "法厄同小行星"],
        ["小熊座流星雨", "12 月 21-22 日", 10, "小熊座", "8P/塔特尔"]
    ];
    var meteorMonth = 0;

    function renderMeteors() {
        var chips = "<button class='chip" + (meteorMonth === 0 ? " active" : "") + "' data-mm='0'>全部</button>";
        for (var m = 1; m <= 12; m++) chips += "<button class='chip" + (meteorMonth === m ? " active" : "") + "' data-mm='" + m + "'>" + m + "月</button>";
        $("#meteorChips").innerHTML = chips;
        $("#meteorBody").innerHTML = METEORS.filter(function (r) {
            return !meteorMonth || r[1].indexOf(meteorMonth + " 月") !== -1;
        }).map(function (r) {
            return "<tr><td><b>" + r[0] + "</b></td><td>" + r[1] + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td><td>" + r[4] + "</td></tr>";
        }).join("") || "<tr><td colspan='5' class='db-empty'>这个月没有主要流星雨，保养望远镜吧。</td></tr>";
    }
    $("#meteorChips").addEventListener("click", function (e) {
        var c = e.target.closest("[data-mm]");
        if (!c) return;
        meteorMonth = +c.getAttribute("data-mm");
        renderMeteors();
    });
    renderMeteors();

    /* 每日星图自动播放 */
    var dailyAutoTimer = null;
    var autoBtn = document.createElement("button");
    autoBtn.className = "btn-line";
    autoBtn.id = "dailyAuto";
    autoBtn.textContent = "自动播放";
    var dailyActs = $("#daily .panel-actions");
    if (dailyActs) {
        dailyActs.appendChild(autoBtn);
        autoBtn.addEventListener("click", function () {
            if (dailyAutoTimer) {
                clearInterval(dailyAutoTimer); dailyAutoTimer = null;
                autoBtn.textContent = "自动播放"; toast("已停止自动播放");
            } else {
                dailyAutoTimer = setInterval(function () {
                    dayIndex = (dayIndex + 1) % DAILY.length; renderDaily(dayIndex);
                }, 4000);
                autoBtn.textContent = "停止播放"; toast("自动播放中，每 4 秒换一张");
            }
        });
    }

    /* ================================================================
       v3.0 航天文库：词典 / 冷知识 / 历史今天 / 结构解析
       ================================================================ */

    var TERMS = [
        ["近地轨道", "LEO", "200~2000 km 高度的轨道，空间站与绝大多数卫星的家。"],
        ["地球同步轨道", "GEO", "35786 km 高度，周期恰为一个恒星日，卫星「静止」于地表上空。"],
        ["转移轨道", "GTO", "连接停泊轨道与同步轨道的大椭圆轨道，近地点点火远地点再点火。"],
        ["第一宇宙速度", "v1", "7.9 km/s，贴地飞行的圆轨道速度，低于它就会掉回来。"],
        ["第二宇宙速度", "v2", "11.2 km/s，逃逸地球引力的最小速度，又称逃逸速度。"],
        ["霍曼转移", "HOHMANN", "两条共面圆轨道间最省燃料的双脉冲转移方案。"],
        ["引力弹弓", "SLINGSHOT", "借行星公转动量给探测器加速，旅行者号的看家本领。"],
        ["停泊轨道", "PARKING", "发射后暂驻的等待轨道，用于测控与选择再点火时机。"],
        ["再入走廊", "CORRIDOR", "返回舱再入角度的安全区间，过陡过烧、过浅弹出。"],
        ["黑障区", "BLACKOUT", "再入时等离子鞘包裹返回舱，无线电中断约 3~5 分钟。"],
        ["比冲", "Isp", "发动机效率指标，单位燃料产生的冲量，液氢氢氧机可达 450 s。"],
        ["整流罩", "FAIRING", "保护卫星的「鼻锥」，入轨后抛离，回收型可反推伞降。"],
        ["级间段", "INTERSTAGE", "连接上下级的筒段，级间分离时的爆索解锁是关键动作。"],
        ["栅格翼", "GRID FIN", "一级回收的姿态舵，钛合金网格结构，耐高温高效气动控制。"],
        ["拉格朗日点", "L-POINT", "两大天体引力平衡点，L2 是韦布望远镜的观测岗哨。"],
        ["潮汐锁定", "TIDAL LOCK", "天体自转与公转周期一致，月球对地球即是典型。"],
        ["轨道衰减", "DECAY", "稀薄大气阻力使轨道缓缓降低，空间站需定期抬轨。"],
        ["姿控发动机", "RCS", "姿态控制小推力发动机组，对接与指向调整全靠它。"],
        ["逃逸塔", "LAUNCH ESCAPE", "载人火箭顶端的救生塔，事故瞬间可把飞船拽离火海。"],
        ["升交点赤经", "RAAN", "轨道面在空间的指向参数，星座组网的关键设计量。"]
    ];

    function renderTerms() {
        var kw = ($("#termSearch").value || "").trim().toLowerCase();
        $("#termList").innerHTML = TERMS.filter(function (t) {
            return !kw || (t[0] + t[1] + t[2]).toLowerCase().indexOf(kw) !== -1;
        }).map(function (t, i) {
            return "<button class='term-item' data-term='" + i + "'><b>" + t[0] + "</b><em>" + t[1] + "</em></button>";
        }).join("") || "<p class='db-empty'>没有找到该术语。</p>";
    }
    $("#termSearch").addEventListener("input", renderTerms);
    renderTerms();

    var FACTS = [
        ["太空中会打呼噜吗？", "会！宇航员在失重下照样打呼噜，空间站隔音差，队友常戴耳塞睡觉。"],
        ["太空里能哭吗？", "眼泪不会往下掉，而是聚成水球糊在眼睛上，只能抹掉。"],
        ["一天看到16次日出", "空间站 90 分钟绕地球一圈，宇航员一天能看 16 次日出日落。"],
        ["脚会脱皮", "失重下脚底角质脱落，宇航员脱袜子时常带下一层皮，新袜子变「陨石坑」。"],
        ["太空有味道", "出舱归来宇航员形容太空闻起来像「烧焦的牛排」或「热金属」。"],
        ["身高会变高", "失重下脊椎舒展，宇航员能「长高」约 5 cm，回地球后缩回。"],
        ["土星会浮在水上", "土星密度 0.687 g/cm³，比水小——如果有足够大的浴缸，它能浮起来。"],
        ["金星上的一天比一年长", "金星自转 243 天、公转 225 天，在金星过完一天等于过了一年多。"],
        ["中子星一勺重60亿吨", "密度大到指甲盖大小的物质重约 10 亿吨，一座城市的质量压进一勺。"],
        ["太阳光走了8分钟", "你看到的太阳是它 8 分 20 秒前的样子，抬头即是「看回过去」。"],
        ["太空垃圾有多快", "一块 1 cm 的漆片以 10 km/s 撞击的动能相当于一颗手雷。"],
        ["火箭的KSP冷知识", "KSP 里的 Kerbin 一天 6 小时，重力 9.81 m/s²——和地球刚好一样巧。"]
    ];

    function renderFacts() {
        $("#factGrid").innerHTML = FACTS.map(function (f, i) {
            return "<div class='fact-card' data-fact='" + i + "'><div class='fact-inner'>" +
                "<div class='fact-face'><span class='f-mark'>❓</span><span class='f-q'>" + f[0] + "</span></div>" +
                "<div class='fact-face fact-back'>" + f[1] + "</div></div></div>";
        }).join("");
        window.observeReveal($("#factGrid"));
    }
    renderFacts();

    var TODAYS = [
        ["01-27", "阿波罗1号悲剧", "1967 年阿波罗 1 号地面测试起火，三名宇航员牺牲，Apollo 计划全面安全整改。"],
        ["02-01", "哥伦比亚号事故", "2003 年哥伦比亚号再入解体，7 名航天员遇难，航天飞机机队停飞两年半。"],
        ["03-18", "人类首次太空行走", "1965 年列昂诺夫离开上升 2 号，漂浮 12 分钟，拉开出舱活动时代。"],
        ["04-12", "加加林进入太空", "1961 年东方一号发射，人类第一次进入太空。4 月 12 日成为世界航天日。"],
        ["04-24", "东方红一号升空", "1970 年中国第一颗人造卫星发射成功，4 月 24 日定为「中国航天日」。"],
        ["05-25", "肯尼迪登月演讲", "1961 年肯尼迪在国会宣布：十年内把人送上月球再安全带回。"],
        ["06-16", "第一位女航天员", "1963 年捷列什科娃乘东方 6 号升空，独自绕地球 48 圈。"],
        ["07-20", "阿波罗11号登月", "1969 年阿姆斯特朗踏上静海，「个人一小步，人类一大步」。"],
        ["08-23", "鹊桥中继星发射", "2018 年鹊桥一号发射，架起地球与月球背面的通信虹桥。"],
        ["09-15", "天宫二号升空", "2016 年天宫二号入轨，中国正式进入空间站时代前夜。"],
        ["10-15", "神舟五号圆梦", "2003 年杨利伟乘神舟五号绕地球 14 圈，中华民族千年飞天梦圆。"],
        ["12-24", "阿波罗8号环月", "1968 年圣诞前夜，人类第一次离开地球引力圈绕月飞行，回望地出。"]
    ];

    function renderToday(seed) {
        var now = new Date();
        var md = String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
        var hit = TODAYS.filter(function (t) { return t[0] === md; });
        var pick = hit.length ? hit[0] : TODAYS[(seed || 0) % TODAYS.length];
        $("#todayBox").innerHTML =
            "<p class='t-date'>" + (hit.length ? "历史上的今天 · " : "航天史上的 · ") + pick[0] + "</p>" +
            "<h4>" + pick[1] + "</h4><p>" + pick[2] + "</p>" +
            "<div class='panel-actions'><button class='btn-line' id='todayNext'>换一条</button></div>";
        $("#todayNext").addEventListener("click", function () {
            renderToday(Math.floor(Math.random() * TODAYS.length));
            beep(760, 0.05, "sine", 0.04);
        });
    }
    renderToday();

    var PARTS = [
        ["🧢", "整流罩", "火箭的「头盔」，护送卫星穿越大气，抛罩是入轨前最后一道关。"],
        ["🗼", "逃逸塔", "载人火箭专属保险：故障瞬间 0.1 秒点火，把飞船拽离危险区。"],
        ["🔥", "一子级发动机", "起飞推力担当。猎鹰九号 9 台梅林并联，推重比 1.3 起步。"],
        ["🔩", "级间段", "上下级的「腰带」，飞行 2 分半后爆索分离，空壳即抛。"],
        ["🪶", "栅格翼", "回收型一级的「翅膀」，再入时张开出鞘，控制姿态滑向着陆点。"],
        ["💨", "喷管", "发动机的「喉咙」，把高温高压燃气整流成超音速气流产生推力。"]
    ];

    $("#partGrid").innerHTML = PARTS.map(function (p, i) {
        return "<button class='part-card' data-part='" + i + "'><span class='p-emoji'>" + p[0] + "</span><b>" + p[1] + "</b></button>";
    }).join("");

    /* ================================================================
       v3.0 凌箭驿站：留言板 / 投票 / 点赞
       ================================================================ */

    var msgListEl = $("#msgList");

    function renderMsgs() {
        var list = store.get("skyarrow_msgs", []);
        msgListEl.innerHTML = list.map(function (m, i) {
            return "<div class='msg-item'><div><div class='m-txt'>" + m.t + "</div><div class='m-meta'>" + m.n + " · " + m.d + "</div></div>" +
                "<button class='m-del' data-msg-del='" + i + "' title='删除'>✕</button></div>";
        }).join("") || "<p class='db-empty'>还没有留言，做第一个留言的人！</p>";
    }

    $("#msgSend").addEventListener("click", function () {
        var t = $("#msgInput").value.trim();
        if (!t) { toast("先写一句话再提交"); return; }
        var n = store.get("skyarrow_name", "") || $("#msgName").value.trim() || "神秘宇航员";
        store.set("skyarrow_name", $("#msgName").value.trim() || n);
        var list = store.get("skyarrow_msgs", []);
        list.unshift({ t: t, n: n, d: new Date().toLocaleString("zh-CN", { hour12: false }) });
        store.set("skyarrow_msgs", list.slice(0, 80));
        $("#msgInput").value = "";
        renderMsgs();
        toast("留言已提交（保存在本机）");
        beep(880, 0.08, "sine", 0.05);
        refreshAch(true);
    });
    msgListEl.addEventListener("click", function (e) {
        var b = e.target.closest("[data-msg-del]");
        if (!b) return;
        var list = store.get("skyarrow_msgs", []);
        list.splice(+b.getAttribute("data-msg-del"), 1);
        store.set("skyarrow_msgs", list);
        renderMsgs();
        toast("已删除该留言");
    });
    renderMsgs();

    var VOTE_OPTS = ["长征七号", "长征八号", "猎鹰9号", "乳齿象发动机"];

    function renderVote() {
        var votes = store.get("skyarrow_votes", {}), voted = store.get("skyarrow_voted", "");
        var total = VOTE_OPTS.reduce(function (s, v, i) { return s + (votes[i] || 0); }, 0) || 1;
        $("#voteBox").innerHTML = VOTE_OPTS.map(function (n, i) {
            var c = votes[i] || 0, pct = (c / total * 100).toFixed(1);
            return "<div class='vote-row'><div class='v-top'><span>" + n + "</span><em>" + c + " 票 · " + pct + "%</em></div>" +
                "<div class='lab-bar'><i style='width:" + pct + "%'></i></div>" +
                "<button class='btn-line' data-vote='" + i + "'" + (voted !== "" ? " disabled style='opacity:.45;cursor:not-allowed'" : "") + ">投它一票</button></div>";
        }).join("") + (voted !== "" ? "<p class='set-note'>你已把票投给了「" + VOTE_OPTS[+voted] + "」，每人只有一票。</p>" : "");
    }
    $("#voteBox").addEventListener("click", function (e) {
        var b = e.target.closest("[data-vote]");
        if (!b || store.get("skyarrow_voted", "") !== "") return;
        var i = +b.getAttribute("data-vote");
        var votes = store.get("skyarrow_votes", {});
        votes[i] = (votes[i] || 0) + 1;
        store.set("skyarrow_votes", votes);
        store.set("skyarrow_voted", i);
        renderVote();
        toast("已投给「" + VOTE_OPTS[i] + "」");
        beep(920, 0.1, "sine", 0.05);
        refreshAch(true);
    });
    renderVote();

    var LIKE_TASKS = [["cz7", "长征七号 · 夜射"], ["cz8", "长征八号 · 首飞"], ["mammoth", "乳齿象 · 试车"], ["falcon9", "猎鹰9 · 载人龙"]];

    function renderLikes() {
        var likes = store.get("skyarrow_likes", {}), mine = store.get("skyarrow_liked_ids", []);
        $("#likeBox").innerHTML = LIKE_TASKS.map(function (t) {
            var liked = mine.indexOf(t[0]) !== -1;
            return "<button class='like-btn" + (liked ? " liked" : "") + "' data-like='" + t[0] + "'>" + (liked ? "❤️" : "🤍") + " " + t[1] + " <b>" + (likes[t[0]] || 0) + "</b></button>";
        }).join("");
    }
    $("#likeBox").addEventListener("click", function (e) {
        var b = e.target.closest("[data-like]");
        if (!b) return;
        var id = b.getAttribute("data-like"), mine = store.get("skyarrow_liked_ids", []);
        if (mine.indexOf(id) !== -1) { toast("已经点过赞啦"); return; }
        mine.push(id);
        store.set("skyarrow_liked_ids", mine);
        var likes = store.get("skyarrow_likes", {});
        likes[id] = (likes[id] || 0) + 1;
        store.set("skyarrow_likes", likes);
        renderLikes();
        toast("点赞成功 ❤️");
        beep(980, 0.07, "sine", 0.05);
        refreshAch(true);
    });
    renderLikes();

    /* ================================================================
       v3.1 无限任务中心：任务生成器 / 星系扫描器 / 火箭拼装厂
       组合数 = 各选项数相乘，真实可复算，不硬编码
       ================================================================ */

    /* ---- 基础数据 ---- */
    var GM_ROCKETS = [
        ["长征七号", 597, 13.5], ["长七甲", 573, 13.5], ["长征八号", 356, 8.1], ["长八甲", 371, 7.0],
        ["长征五号", 869, 25], ["长征五号B", 837, 25], ["长征二号F", 497, 8.6], ["长征三号乙", 459, 11],
        ["长征九号", 4122, 150], ["猎鹰9号", 549, 22.8], ["猎鹰重型", 1421, 63.8], ["星舰", 5000, 150],
        ["阿丽亚娜6 A64", 900, 21.6], ["宇宙神5", 590, 18.8], ["德尔塔IV重型", 733, 28.8], ["电子号", 13, 0.3]
    ];
    var GM_PAYLOADS = [
        ["高通量通信卫星", 5.2], ["货运飞船", 13.5], ["载人飞船", 8.1], ["空间望远镜", 6.2],
        ["深空探测器", 3.8], ["月球着陆器", 3.2], ["火星巡视车", 1.05], ["空间站舱段", 22],
        ["导航组网卫星", 2.4], ["遥感卫星", 1.2], ["科学实验卫星", 0.8], ["轨道燃料补加器", 7.5]
    ];
    var GM_TARGETS = [
        ["LEO-300 近地驻留", 9.4], ["LEO-400 空间站对接", 9.45], ["SSO-500 太阳同步", 9.6],
        ["MEO-20000 导航星座", 10.8], ["GTO 同步转移", 11.6], ["GEO 直入同步", 12.3],
        ["TLI 地月转移", 10.9], ["TMI 地火转移", 11.5], ["TVI 金星转移", 11.3], ["小行星交会", 11.0]
    ];
    var GM_SITES = ["文昌 LC-101", "酒泉 LC-43", "太原 LC-9", "西昌 LC-2", "肯尼迪 LC-39A", "库鲁 ELA-3"];
    var GM_WEATHER = [["晴空", 99], ["少云", 96], ["夜间发射", 97], ["低空积云", 90], ["高空风", 84]];
    var GM_BOOST = [["无助推", 0, 0], ["2× 固体助推", 2.5, 80], ["4× 固体助推", 5, 160], ["一级回收构型", -1.2, -12]];

    var GM_COMBOS = GM_ROCKETS.length * GM_PAYLOADS.length * GM_TARGETS.length *
        GM_SITES.length * GM_WEATHER.length * GM_BOOST.length;

    function optsHtml(arr, k) {
        return arr.map(function (x, i) { return "<option value='" + i + "'>" + x[0] + "</option>"; }).join("");
    }
    function pickSel(id) { return +document.getElementById(id).value; }
    function randSel(id) { var el = document.getElementById(id); el.selectedIndex = Math.floor(Math.random() * el.options.length); }

    var lastMission = null;

    function renderMissionSheet() {
        var r = GM_ROCKETS[pickSel("gmRocket")], p = GM_PAYLOADS[pickSel("gmPayload")],
            tgt = GM_TARGETS[pickSel("gmTarget")], site = GM_SITES[pickSel("gmSite")],
            w = GM_WEATHER[pickSel("gmWeather")], bo = GM_BOOST[pickSel("gmBoost")];
        var cap = r[2] + bo[1], mass = r[1] + bo[2];
        var over = p[1] - cap;
        var score = Math.max(30, Math.min(99, Math.round(w[1] - Math.max(0, over) * 4 + (Math.random() * 4 - 2))));
        var d = new Date(Date.now() + (1 + Math.floor(Math.random() * 60)) * 86400000 + Math.floor(Math.random() * 86400000));
        var dstr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") +
            " " + String(d.getHours()).padStart(2, "0") + ":" + (Math.floor(Math.random() * 6) * 10).toFixed(0) + "0";
        var az = 88 + Math.floor(Math.random() * 72), win = 5 + Math.floor(Math.random() * 111);
        var code = "SA-" + (260000 + Math.floor(Math.random() * 739999));
        var scCls = score >= 90 ? "gs-ok" : score >= 70 ? "" : score >= 50 ? "gs-warn" : "gs-bad";
        var fitCls = over <= 0 ? "gs-ok" : over <= 1.5 ? "gs-warn" : "gs-bad";

        lastMission = {
            icon: "🎲", type: "mission",
            title: code + " · " + r[0] + " · " + tgt[0],
            sub: p[0] + " · " + site + " · " + dstr.slice(0, 10) + " · 成功指数 " + score + "%",
            code: code
        };

        $("#gmOut").innerHTML =
            "<div class='gs-id'>任务编号 " + code + "</div>" +
            "<div class='gs-row'><span>运载火箭</span><b>" + r[0] + "（" + bo[0] + "）</b></div>" +
            "<div class='gs-row'><span>载荷</span><b>" + p[0] + " · " + p[1] + " t</b></div>" +
            "<div class='gs-row'><span>目标轨道</span><b>" + tgt[0] + "</b></div>" +
            "<div class='gs-row'><span>发射场 / 方位</span><b>" + site + " · " + az + "°</b></div>" +
            "<div class='gs-row'><span>气象条件</span><b>" + w[0] + "</b></div>" +
            "<div class='gs-row'><span>发射窗口</span><b>" + dstr + " · 窗口 " + win + " 分钟</b></div>" +
            "<div class='gs-row'><span>起飞质量</span><b>" + mass.toFixed(0) + " t</b></div>" +
            "<div class='gs-row'><span>Δv 预算</span><b>" + (tgt[1] + 0.15).toFixed(2) + " km/s</b></div>" +
            "<div class='gs-row'><span>运力校核</span><b class='" + fitCls + "'>LEO 运力 " + cap.toFixed(1) + " t · " +
                (over <= 0 ? "余量 " + (-over).toFixed(1) + " t ✓" : "超载 " + over.toFixed(1) + " t ✗") + "</b></div>" +
            "<div class='gs-row'><span>成功指数</span><b class='" + scCls + "'>" + score + "%</b></div>" +
            "<div class='lab-bar' style='margin-top:10px'><i style='width:" + score + "%'></i></div>";
    }

    var genMissionEl = $("#genMission");
    genMissionEl.innerHTML =
        "<h3>🎲 随机任务生成器</h3><p class='tool-tip'>六组参数组合，每次都是一份新的发射任务书</p>" +
        "<div class='gen-selects'>" +
        "<label>火箭<select id='gmRocket'>" + optsHtml(GM_ROCKETS) + "</select></label>" +
        "<label>载荷<select id='gmPayload'>" + optsHtml(GM_PAYLOADS) + "</select></label>" +
        "<label>目标轨道<select id='gmTarget'>" + optsHtml(GM_TARGETS) + "</select></label>" +
        "<label>发射场<select id='gmSite'>" + GM_SITES.map(function (s, i) { return "<option value='" + i + "'>" + s + "</option>"; }).join("") + "</select></label>" +
        "<label>气象<select id='gmWeather'>" + optsHtml(GM_WEATHER) + "</select></label>" +
        "<label>助推构型<select id='gmBoost'>" + optsHtml(GM_BOOST) + "</select></label>" +
        "</div>" +
        "<div class='g-actions' style='justify-content:flex-start'>" +
        "<button class='btn-line' id='gmDice'>🎲 随机任务</button>" +
        "<button class='btn-line' id='gmSave'>收入设计本</button></div>" +
        "<div class='gen-sheet' id='gmOut'></div>" +
        "<div class='gen-combo'>真实组合空间：<b>" + GM_ROCKETS.length + " × " + GM_PAYLOADS.length + " × " + GM_TARGETS.length +
        " × " + GM_SITES.length + " × " + GM_WEATHER.length + " × " + GM_BOOST.length + " = " + GM_COMBOS.toLocaleString() + "</b> 种任务书</div>";
    ["gmRocket", "gmPayload", "gmTarget", "gmSite", "gmWeather", "gmBoost"].forEach(function (id) {
        document.getElementById(id).addEventListener("change", renderMissionSheet);
    });
    $("#gmDice").addEventListener("click", function () {
        ["gmRocket", "gmPayload", "gmTarget", "gmSite", "gmWeather", "gmBoost"].forEach(randSel);
        renderMissionSheet();
        var n = store.get("skyarrow_gm_count", 0) + 1;
        store.set("skyarrow_gm_count", n);
        refreshAch(true);
        beep(700, 0.06, "sine", 0.05);
    });
    for (var ri = 0; ri < 5; ri++) randSel("gmRocket");  /* 默认随机一项 */
    document.getElementById("gmRocket").selectedIndex = 9;  /* 默认猎鹰9号 */
    renderMissionSheet();

    /* ---- 星系扫描器（2^32 种子空间） ---- */

    function xmur3(str) {
        for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = h << 13 | h >>> 19;
        }
        return function () {
            h = Math.imul(h ^ h >>> 16, 2246822507);
            h = Math.imul(h ^ h >>> 13, 3266489909);
            return (h ^= h >>> 16) >>> 0;
        };
    }
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    var STARS = [
        ["O", 30, 8, 40000, 100000, 0.00003], ["B", 8, 4, 18000, 800, 0.0013],
        ["A", 2.2, 1.8, 8500, 20, 0.006], ["F", 1.4, 1.3, 6500, 4, 0.03],
        ["G", 1.05, 1.0, 5700, 1.2, 0.076], ["K", 0.75, 0.8, 4500, 0.35, 0.12],
        ["M", 0.35, 0.4, 3200, 0.03, 0.76]
    ];
    var PLANET_ICONS = { "气态巨行星": "🪐", "冰巨行星": "🔵", "海洋行星": "🌊", "宜居岩质行星": "🌍", "冰冻岩质": "🧊", "熔岩行星": "🌋", "炙热刺岩": "🪨" };
    var lastSystem = null;

    function scanSystem(seedText) {
        var seedStr = seedText || String(Date.now()) + "-" + Math.floor(Math.random() * 1e9);
        var seedFn = xmur3(seedStr), seed = seedFn();
        var rng = mulberry32(seed);
        var roll = rng(), acc = 0, cls = STARS[STARS.length - 1];
        for (var i = 0; i < STARS.length; i++) { acc += STARS[i][5]; if (roll <= acc) { cls = STARS[i]; break; } }
        var M = cls[1] * (0.85 + rng() * 0.3), R = cls[2] * (0.9 + rng() * 0.2);
        var T = Math.round(cls[3] * (0.92 + rng() * 0.16)), L = cls[4] * (0.7 + rng() * 0.6);
        var hzIn = Math.sqrt(L) * 0.9, hzOut = Math.sqrt(L) * 1.4;
        var nP = Math.floor(rng() * 10);
        var planets = [], hab = 0, letters = "bcdefghij";
        for (var k = 0; k < nP; k++) {
            var a = 0.35 * Math.pow(1.75, k) + rng() * 0.18;
            var per = Math.sqrt(Math.pow(a, 3) / M);
            var type, pr, moons, icon;
            if (a < hzIn) { type = rng() < 0.5 ? "熔岩行星" : "炙热刺岩"; pr = 0.8 + rng() * 0.6; moons = rng() < 0.4 ? 0 : 1; }
            else if (a <= hzOut) {
                type = rng() < 0.4 ? "海洋行星" : "宜居岩质行星"; hab++;
                pr = 0.9 + rng() * 0.5; moons = Math.floor(rng() * 3);
            } else {
                var q = rng();
                if (q < 0.25) { type = "气态巨行星"; pr = 8 + rng() * 8; moons = 4 + Math.floor(rng() * 17); }
                else if (q < 0.5) { type = "冰巨行星"; pr = 3 + rng() * 2; moons = 1 + Math.floor(rng() * 9); }
                else { type = "冰冻岩质"; pr = 0.7 + rng() * 0.8; moons = rng() < 0.6 ? Math.floor(rng() * 3) : 0; }
            }
            planets.push({ letter: letters[k], a: a, per: per, type: type, pr: pr, moons: moons });
        }
        var hd = "HD-" + (10000 + seed % 89999);
        return { str: seedStr, hd: hd, cls: cls[0], M: M, R: R, T: T, L: L, hzIn: hzIn, hzOut: hzOut, planets: planets, hab: hab };
    }

    function renderSystem(sys) {
        var html =
            "<div class='gs-id'>" + sys.hd + " · 光谱型 " + sys.cls + "</div>" +
            "<div class='gs-row'><span>恒星质量</span><b>" + sys.M.toFixed(2) + " M☉</b></div>" +
            "<div class='gs-row'><span>恒星半径</span><b>" + sys.R.toFixed(2) + " R☉</b></div>" +
            "<div class='gs-row'><span>表面温度</span><b>" + sys.T.toLocaleString() + " K</b></div>" +
            "<div class='gs-row'><span>光度</span><b>" + sys.L.toFixed(3) + " L☉</b></div>" +
            "<div class='gs-row'><span>宜居带</span><b class='gs-ok'>" + sys.hzIn.toFixed(2) + " ~ " + sys.hzOut.toFixed(2) + " AU</b></div>" +
            "<div class='gs-row'><span>行星数</span><b>" + sys.planets.length + " 颗 · " + sys.hab + " 颗位于宜居带</b></div>";
        sys.planets.forEach(function (p) {
            var hz = (p.type === "海洋行星" || p.type === "宜居岩质行星");
            html += "<div class='gen-planet'><span>" + PLANET_ICONS[p.type] + " <em>" + sys.hd.slice(3) + " " + p.letter + "</em> · " +
                p.type + (hz ? " <span class='hz'>★ 宜居候选</span>" : "") + "</span>" +
                "<span>" + p.a.toFixed(2) + " AU · " + (p.per < 1 ? (p.per * 365).toFixed(0) + " 天" : p.per.toFixed(1) + " 年") +
                " · " + p.pr.toFixed(1) + " R⊕ · " + p.moons + " 卫星</span></div>";
        });
        $("#gsOut").innerHTML = "<div class='gen-sheet'>" + html + "</div>";
    }

    var genSysEl = $("#genSystem");
    genSysEl.innerHTML =
        "<h3>🌌 星系扫描器</h3><p class='tool-tip'>输入任意种子（或留空随机），算法决定一颗恒星与它的行星系</p>" +
        "<div class='gen-selects' style='grid-template-columns:1fr'><label>种子（任意文字 / 编号）<input type='text' id='gsSeed' placeholder='例如：lingjian-2026，留空随机'></label></div>" +
        "<div class='g-actions' style='justify-content:flex-start'>" +
        "<button class='btn-line' id='gsGo'>🔭 扫描星系</button>" +
        "<button class='btn-line' id='gsSave'>记录到设计本</button></div>" +
        "<div id='gsOut'></div>" +
        "<div class='gen-combo'>种子空间：<b>2³² = 4,294,967,296</b> 种（哈希确定，同一种子永远生成同一星系）</div>";

    $("#gsGo").addEventListener("click", function () {
        lastSystem = scanSystem($("#gsSeed").value.trim());
        renderSystem(lastSystem);
        var n = store.get("skyarrow_sys_count", 0) + 1;
        store.set("skyarrow_sys_count", n);
        refreshAch(true);
        beep(520 + Math.floor(Math.random() * 300), 0.1, "sine", 0.05);
    });
    $("#gsSave").addEventListener("click", function () {
        if (!lastSystem) { toast("先扫描一个星系"); return; }
        addToBook({
            icon: "🌌", type: "system",
            title: lastSystem.hd + " · " + lastSystem.cls + " 型恒星",
            sub: lastSystem.planets.length + " 颗行星 · " + lastSystem.hab + " 颗宜居候选 · 种子 " + lastSystem.str.slice(0, 18)
        });
    });
    renderSystem(lastSystem = scanSystem("skyarrow"));

    /* ---- 火箭拼装厂 ---- */

    var GR_DIAM = ["3.35 m 长征标准径", "3.8 m 猎鹰级", "5.0 m 长五/星舰级", "9.0 m 超重型"];
    var GR_ENG = [
        ["YF-100K · 液氧煤油", 120, "长征", 0],
        ["YF-77 · 液氢液氧", 70, "长天", 1],
        ["YF-100M · 改进煤油", 125, "长征", 2],
        ["Merlin 1D · 燃气煤油", 90, "猎鹰", 3],
        ["Raptor 2 · 液氧甲烷", 230, "星箭", 4],
        ["RD-180 · 高压补燃", 390, "天顶", 5],
        ["BE-4 · 液氧甲烷", 246, "新格", 6],
        ["卢瑟福 · 电泵循环", 2.6, "电子", 7]
    ];
    var GR_BOOST_N = [0, 2, 4, 6];
    var GR_UPPER = ["无上面级", "氢氧上面级", "远征多次点火上面级", "真空优化上面级"];
    var GR_UPPER_H = [0, 6, 5, 4];
    var GR_UPPER_M = [0.92, 1.12, 1.05, 1.08];
    var GR_FAIR = ["4.2 m 标准罩", "5.2 m 大运力罩", "9 m 全复用罩"];
    var GR_FAIR_H = [8, 11, 17];
    var GR_DIAM_V = [3.35, 3.8, 5.0, 9.0];
    var ENG_COUNT_BY_DIAM = [6, 9, 8, 33];
    var GR_COMBOS = GR_DIAM.length * GR_ENG.length * GR_BOOST_N.length * GR_UPPER.length * GR_FAIR.length * GM_PAYLOADS.length;
    var lastRocket = null;

    function renderRocketSheet() {
        var di = pickSel("grDiam"), eng = GR_ENG[pickSel("grEng")], bn = GR_BOOST_N[pickSel("grBoost")],
            ui = pickSel("grUpper"), fi = pickSel("grFair"), pay = GM_PAYLOADS[pickSel("grPay")];
        var diam = GR_DIAM_V[di];
        var nEng = eng[3] === 7 ? 9 : ENG_COUNT_BY_DIAM[di];
        var thrust = nEng * eng[1] + bn * 120;
        var height = 24 + diam * 7.2 + GR_UPPER_H[ui] + GR_FAIR_H[fi];
        var cap;
        if (eng[3] === 7) cap = thrust / 92;
        else cap = thrust / 38 * Math.pow(diam / 3.35, 0.35) * GR_UPPER_M[ui];
        cap = Math.max(0.1, Math.min(180, cap));
        var name = eng[2] + "-" + String(Math.round(diam * 100)) + String.fromCharCode(65 + eng[3]) + (bn ? bn + "B" : "");
        var fit = pay[1] - cap;
        var fitCls = fit <= 0 ? "gs-ok" : fit <= 1.5 ? "gs-warn" : "gs-bad";
        lastRocket = {
            icon: "🔧", type: "rocket",
            title: name + " · 总装方案",
            sub: nEng + "×" + eng[0].split(" · ")[0] + " · 高 " + height.toFixed(0) + " m · LEO " + cap.toFixed(1) + " t"
        };
        $("#grOut").innerHTML =
            "<div class='gs-id'>总装编号 RK-" + (30000 + Math.floor(Math.random() * 69999)) + " · 型号 " + name + "</div>" +
            "<div class='gs-row'><span>芯级直径</span><b>" + diam + " m</b></div>" +
            "<div class='gs-row'><span>一级动力</span><b>" + nEng + " × " + eng[0] + "</b></div>" +
            "<div class='gs-row'><span>固体助推</span><b>" + bn + " 枚（单枚 120 t 推力）</b></div>" +
            "<div class='gs-row'><span>上面级</span><b>" + GR_UPPER[ui] + "</b></div>" +
            "<div class='gs-row'><span>整流罩</span><b>" + GR_FAIR[fi] + "</b></div>" +
            "<div class='gs-row'><span>总高（估算）</span><b>" + height.toFixed(1) + " m</b></div>" +
            "<div class='gs-row'><span>起飞推力</span><b>" + thrust.toFixed(0) + " t</b></div>" +
            "<div class='gs-row'><span>LEO 运力（估算）</span><b>" + cap.toFixed(1) + " t</b></div>" +
            "<div class='gs-row'><span>" + pay[0] + " 适配</span><b class='" + fitCls + "'>" +
                (fit <= 0 ? "余量 " + (-fit).toFixed(1) + " t ✓" : "超载 " + fit.toFixed(1) + " t ✗") + "</b></div>";
    }

    $("#genRocket").innerHTML =
        "<h3>🔧 火箭拼装厂</h3><p class='tool-tip'>选定芯级 / 动力 / 助推 / 上面级 / 整流罩 / 目标载荷，实时估算运力</p>" +
        "<div class='gen-selects' style='grid-template-columns:repeat(3,1fr)'>" +
        "<label>芯级直径<select id='grDiam'>" + GR_DIAM.map(function (x, i) { return "<option value='" + i + "'>" + x + "</option>"; }).join("") + "</select></label>" +
        "<label>一级发动机<select id='grEng'>" + GR_ENG.map(function (x, i) { return "<option value='" + i + "'>" + x[0] + "</option>"; }).join("") + "</select></label>" +
        "<label>固体助推<select id='grBoost'>" + GR_BOOST_N.map(function (x, i) { return "<option value='" + i + "'>" + x + " 枚</option>"; }).join("") + "</select></label>" +
        "<label>上面级<select id='grUpper'>" + GR_UPPER.map(function (x, i) { return "<option value='" + i + "'>" + x + "</option>"; }).join("") + "</select></label>" +
        "<label>整流罩<select id='grFair'>" + GR_FAIR.map(function (x, i) { return "<option value='" + i + "'>" + x + "</option>"; }).join("") + "</select></label>" +
        "<label>目标载荷<select id='grPay'>" + optsHtml(GM_PAYLOADS) + "</select></label>" +
        "</div>" +
        "<div class='g-actions' style='justify-content:flex-start'>" +
        "<button class='btn-line' id='grGo'>⚙ 总装计算</button>" +
        "<button class='btn-line' id='grSave'>收入设计本</button></div>" +
        "<div class='gen-sheet' id='grOut'></div>" +
        "<div class='gen-combo'>真实构型空间：<b>" + GR_DIAM.length + " × " + GR_ENG.length + " × " + GR_BOOST_N.length + " × " +
        GR_UPPER.length + " × " + GR_FAIR.length + " × " + GM_PAYLOADS.length + " = " + GR_COMBOS.toLocaleString() + "</b> 种构型</div>";
    ["grDiam", "grEng", "grBoost", "grUpper", "grFair", "grPay"].forEach(function (id) {
        document.getElementById(id).addEventListener("change", renderRocketSheet);
    });
    $("#grGo").addEventListener("click", function () {
        renderRocketSheet();
        var n = store.get("skyarrow_rk_count", 0) + 1;
        store.set("skyarrow_rk_count", n);
        refreshAch(true);
        beep(620, 0.07, "square", 0.05);
    });
    $("#grSave").addEventListener("click", function () {
        if (!lastRocket) return;
        addToBook(lastRocket);
    });
    document.getElementById("grEng").selectedIndex = 4;  /* 默认 Raptor */
    renderRocketSheet();

    /* ---- 生成空间总数（真实乘积求和） ---- */
    var GEN_TOTAL = GM_COMBOS + GR_COMBOS + Math.pow(2, 32);
    $("#genTotal").textContent =
        "任务 " + GM_COMBOS.toLocaleString() + " 种 + 火箭 " + GR_COMBOS.toLocaleString() +
        " 种 + 星系种子 " + Math.pow(2, 32).toLocaleString() + " 种 = " + GEN_TOTAL.toLocaleString() + " 种可能";

    /* ---- 设计本 ---- */

    function addToBook(item) {
        var list = store.get("skyarrow_genbook", []);
        item.time = new Date().toLocaleString("zh-CN", { hour12: false });
        list.unshift(item);
        store.set("skyarrow_genbook", list.slice(0, 40));
        renderBook();
        toast("已收入设计本");
        beep(920, 0.08, "sine", 0.05);
    }
    $("#gmSave").addEventListener("click", function () {
        if (!lastMission) return;
        addToBook(lastMission);
    });
    function renderBook() {
        var list = store.get("skyarrow_genbook", []);
        $("#genBook").innerHTML = list.map(function (b, i) {
            return "<div class='gb-item'><span class='gb-icon'>" + b.icon + "</span><div class='gb-main'>" +
                "<div class='gb-title'>" + b.title + "</div><div class='gb-sub'>" + b.sub + " · " + b.time + "</div></div>" +
                "<button class='gb-del' data-book-del='" + i + "' title='删除'>✕</button></div>";
        }).join("") || "<p class='db-empty'>设计本还是空的——去生成点什么吧。</p>";
    }
    $("#genBook").addEventListener("click", function (e) {
        var b = e.target.closest("[data-book-del]");
        if (!b) return;
        var list = store.get("skyarrow_genbook", []);
        list.splice(+b.getAttribute("data-book-del"), 1);
        store.set("skyarrow_genbook", list);
        renderBook();
    });
    renderBook();

    /* ---- 成就墙（29 项，条件全部来自真实本机数据） ---- */

    var RANK = { C: 1, B: 2, A: 3, S: 4 };

    function achStats() {
        return {
            visits: store.get("skyarrow_visits", 0),
            favs: store.get("skyarrow_favs", []).length,
            dm: store.get("skyarrow_danmaku", []).length,
            msg: store.get("skyarrow_msgs", []).length,
            voted: store.get("skyarrow_voted", "") !== "",
            liked: store.get("skyarrow_liked_ids", []).length,
            gm: store.get("skyarrow_gm_count", 0),
            sys: store.get("skyarrow_sys_count", 0),
            rk: store.get("skyarrow_rk_count", 0),
            react: store.get("skyarrow_react_best", 0),
            wpm: store.get("skyarrow_type_best", 0),
            lw: store.get("skyarrow_lw", 0),
            lg: store.get("skyarrow_lg", "C"),
            mem: store.get("skyarrow_mem_best", 99),
            tile: store.get("skyarrow_2048_max", 0),
            quiz: store.get("skyarrow_quiz_best", 0),
            feat: store.get("skyarrow_feat_opens", 0)
        };
    }

    var ACH = [
        ["🛰", "入轨访客", "第一次打开凌箭航天", function (s) { return s.visits >= 1; }],
        ["🔁", "任务常客", "累计来访 10 次", function (s) { return s.visits >= 10; }],
        ["☆", "第一次收藏", "收藏第一个任务", function (s) { return s.favs >= 1; }],
        ["🌟", "五星收藏夹", "收藏 5 个任务", function (s) { return s.favs >= 5; }],
        ["📚", "档案管理员", "收藏 10 个任务", function (s) { return s.favs >= 10; }],
        ["💬", "弹幕新兵", "发射第一条弹幕", function (s) { return s.dm >= 1; }],
        ["📡", "弹幕指挥官", "发射 5 条弹幕", function (s) { return s.dm >= 5; }],
        ["✍", "第一帖", "在驿站写下留言", function (s) { return s.msg >= 1; }],
        ["🪶", "留言熟客", "累计 5 条留言", function (s) { return s.msg >= 5; }],
        ["🗳", "庄严一票", "投出最爱的火箭", function (s) { return s.voted; }],
        ["❤️", "爱心一枚", "为任务点一次赞", function (s) { return s.liked >= 1; }],
        ["🎲", "任务设计师", "生成 1 份任务书", function (s) { return s.gm >= 1; }],
        ["📋", "排期大师", "生成 10 份任务书", function (s) { return s.gm >= 10; }],
        ["🏛", "百案总师", "生成 50 份任务书", function (s) { return s.gm >= 50; }],
        ["🔭", "观星者", "扫描 1 个星系", function (s) { return s.sys >= 1; }],
        ["🗺", "星图测绘师", "扫描 10 个星系", function (s) { return s.sys >= 10; }],
        ["🌌", "深空巡天", "扫描 50 个星系", function (s) { return s.sys >= 50; }],
        ["🔧", "火箭工程师", "总装 1 枚火箭", function (s) { return s.rk >= 1; }],
        ["🏗", "总师潜质", "总装 10 枚火箭", function (s) { return s.rk >= 10; }],
        ["⚡", "反应神速", "反应测试快于 300 ms", function (s) { return s.react && s.react < 300; }],
        ["🎯", "航天员反射", "反应测试快于 240 ms", function (s) { return s.react && s.react < 240; }],
        ["⌨", "测控打字员", "速打突破 40 WPM", function (s) { return s.wpm >= 40; }],
        ["🚀", "指尖测控", "速打突破 60 WPM", function (s) { return s.wpm >= 60; }],
        ["🛬", "着陆指挥官", "完成一次软着陆", function (s) { return s.lw >= 1; }],
        ["🏅", "S 级着陆", "以 S 级完成着陆", function (s) { return RANK[s.lg] >= RANK.S; }],
        ["🃏", "记忆大师", "记忆游戏 14 步内通关", function (s) { return s.mem <= 14; }],
        ["🔢", "2048 之星", "星际 2048 合成 512", function (s) { return s.tile >= 512; }],
        ["🎓", "满分学霸", "小测验拿到 10/10", function (s) { return s.quiz >= 10; }],
        ["🧭", "索引阅读者", "从功能总览跳转 10 次", function (s) { return s.feat >= 10; }]
    ];

    function refreshAch(announce) {
        var s = achStats(), unlocked = store.get("skyarrow_ach", []), newly = [];
        ACH.forEach(function (a, i) {
            if (unlocked.indexOf(i) === -1) {
                try { if (a[3](s)) { unlocked.push(i); if (announce) newly.push(a); } } catch (e) {}
            }
        });
        store.set("skyarrow_ach", unlocked);
        renderAch(unlocked, newly);
    }

    function renderAch(unlocked, newly) {
        var grid = $("#achGrid");
        if (!grid) return;
        grid.innerHTML = ACH.map(function (a, i) {
            var on = unlocked.indexOf(i) !== -1, pop = newly.some(function (n2) { return n2 === a; });
            return "<div class='ach-item" + (on ? " unlocked" : "") + (pop ? " just" : "") + "'>" +
                "<span class='ach-icon'>" + (on ? a[0] : "🔒") + "</span><div><b>" + a[1] + "</b><small>" + a[2] + "</small></div></div>";
        }).join("");
        $("#achStat").textContent = "（已解锁 " + unlocked.length + " / " + ACH.length + "）";
    }
    refreshAch(false);

    /* ==================== 快捷键 ==================== */

    document.addEventListener("keydown", function (e) {
        var typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);

        if (e.key === "Escape") {
            if (screensaverOn) { setScreensaver(false); return; }
            if (lightbox.classList.contains("open")) closeLightbox();
            else if (modal.classList.contains("open")) closeModal();
            else if (searchModal.classList.contains("open")) closeSearch();
            else if (overlay.classList.contains("open")) setMenu(false);
            return;
        }
        if (typing) return;

        if (lightbox.classList.contains("open")) {
            if (e.key === "ArrowLeft") showLb(lbIndex - 1);
            if (e.key === "ArrowRight") showLb(lbIndex + 1);
            return;
        }

        /* 着陆游戏进行中：WASD / 方向键交给游戏，不触发全局快捷键 */
        if (currentGame === "lander" && landerRunning) {
            var gk = e.key.toLowerCase();
            if (["w", "a", "s", "d", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(gk) !== -1) return;
        }

        /* 打字彩蛋 SKYARROW */
        typedBuf = (typedBuf + e.key.toLowerCase()).slice(-8);
        if (typedBuf === "skyarrow") { typedBuf = ""; starRain(24); toast("🛸 识别到暗号：凌箭，随时准备点火"); }

        var k = e.key.toLowerCase();
        if (k === "m") { setMenu(!overlay.classList.contains("open")); }
        else if (k === "s") { openSearch(); }
        else if (k === "t") { window.scrollTo({ top: 0, behavior: "smooth" }); }
        else if (k === "p") { soundToggle.click(); }
        else if (e.key === "?") { openFeatures(); }
    });

    /* ================================================================
       v3.2 发射点播系统（访客申请 → 博主点火 → 双端实时联动）
       通信：BroadcastChannel（同域多标签页）+ localStorage 兜底
       ================================================================ */

    var LP_ROCKETS = ["长征五号", "长征五号B", "长征七号", "长征八号", "长征二号F", "猎鹰9号", "猎鹰重型", "星舰", "SLS", "土星五号"];
    var LP_TARGETS = ["空间站对接", "月球采样返回", "火星着陆", "木星探测", "深空天文台", "金星巡游", "近地轨道驻留", "太阳同步卫星", "通信卫星组网"];
    var lpTicketKey = "skyarrow_launch_tickets";
    var lpMyTicket = null;
    var bc = null;
    try { bc = new BroadcastChannel("skyarrow_launch"); } catch (e) { bc = null; }

    /* 网络通道：ntfy.sh 免费消息服务，让 GitHub Pages 用户端与博主 EXE 跨网络互通 */
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
    function lpNetApply(msg) {
        /* 应用博主端（EXE）推来的状态更新，按票据 id 匹配 */
        if (!msg || !msg.ticket || !msg.ticket.id) return;
        var tickets = lpGetTickets();
        var idx = tickets.findIndex(function (x) { return x.id === msg.ticket.id; });
        if (idx < 0) { tickets.unshift(msg.ticket); } else { tickets[idx] = msg.ticket; }
        lpSetTickets(tickets);
        lpRenderPad();
        var t = msg.ticket;
        if (lpMyTicket && t.id === lpMyTicket.id) {
            if (msg.type === "accepted") {
                toast("🎬 博主已接单：" + t.rocket);
                lpNotify("🎬 凌箭航天 · 博主已接单", "你的「" + t.rocket + " → " + t.target + "」正在拍摄，发布后这里会出现观看链接");
            } else if (msg.type === "done" && !lpNotifiedDone) {
                lpNotifiedDone = true;
                toast("🚀 视频已发布！");
                lpNotify("🚀 凌箭航天 · 视频已发布", "你的「" + t.rocket + "」已发抖音，回站点击「去抖音看视频」");
            } else if (msg.type === "cancelled") {
                toast("😢 博主取消了这条点播");
            }
        }
    }
    function lpNetListen() {
        try {
            var es = new EventSource(LP_NTFY + "/sse");
            es.onmessage = function (ev) {
                try { lpNetApply(JSON.parse(ev.data)); } catch (e) {}
            };
        } catch (e) {}
    }
    /* 定期同步：把博主端的接单/发布/取消同步到本地票（SSE 断流兜底） */
    function lpNetSync() {
        try {
            fetch(LP_NTFY + "/json?poll=1").then(function (r) { return r.text(); }).then(function (txt) {
                var dirty = false;
                txt.split("\n").forEach(function (line) {
                    if (!line.trim()) return;
                    var ev; try { ev = JSON.parse(line); } catch (e) { return; }
                    if (ev.event !== "message" || !ev.message) return;
                    var msg; try { msg = JSON.parse(ev.message); } catch (e) { return; }
                    if (!msg || !msg.ticket || !msg.ticket.id || msg.type === "new_ticket") return;
                    var tickets = lpGetTickets();
                    var idx = tickets.findIndex(function (x) { return x.id === msg.ticket.id; });
                    if (idx < 0) return;
                    if (msg.type === "cancelled") { tickets.splice(idx, 1); } else { tickets[idx] = msg.ticket; }
                    lpSetTickets(tickets);
                    dirty = true;
                });
                if (dirty) lpRenderPad();
            }).catch(function () {});
        } catch (e) {}
    }

    function lpGetTickets() { return store.get(lpTicketKey, []); }
    function lpSetTickets(t) { store.set(lpTicketKey, t.slice(0, 20)); }

    var lpNotifiedDone = false;

    /* Windows 系统通知（浏览器 Notification API，弹系统级弹窗） */
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

    function lpMineNow() {
        if (!lpMyTicket) return null;
        return lpGetTickets().find(function (x) { return x.id === lpMyTicket.id; }) || null;
    }

    function lpListen() {
        if (bc) {
            bc.onmessage = function (ev) {
                if (ev.data.type === "launch") {
                    /* 博主接单：不播动画，改为 Windows 系统通知 */
                    lpRenderPad();
                    var tk = ev.data.ticket;
                    if (tk) {
                        toast("🎬 博主已接单：" + tk.rocket);
                        if (lpMyTicket && tk.id === lpMyTicket.id) {
                            lpNotify("🎬 凌箭航天 · 博主已接单",
                                "你的「" + tk.rocket + " → " + tk.target + "」正在拍摄，发布后这里会出现观看链接");
                        }
                    }
                } else if (ev.data.type === "tickets_changed") {
                    /* 我的票被贴链接（发布）时，也弹一次系统通知 */
                    var mine = lpMineNow();
                    if (mine && mine.status === "done" && mine.video && !lpNotifiedDone) {
                        lpNotifiedDone = true;
                        lpNotify("🚀 凌箭航天 · 视频已发布",
                            "你的「" + mine.rocket + "」已发抖音，回站点击「去抖音看视频」");
                    }
                    lpRenderPad();
                }
            };
        }
        /* storage 事件兜底：同 origin 其他标签页（博主台 boss.html）改写票据时刷新 */
        window.addEventListener("storage", function (e) {
            if (e.key === lpTicketKey) lpRenderPad();
        });
        /* 首次点击页面时请求通知权限（浏览器要求用户手势后才能授权） */
        document.addEventListener("click", function reqPerm() {
            if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
            document.removeEventListener("click", reqPerm);
        });
    }

    function lpNowTime() { return new Date().toLocaleString("zh-CN", { hour12: false }); }

    function lpRenderPad() {
        var tickets = lpGetTickets(), mine = null;
        if (lpMyTicket) mine = tickets.find(function (t) { return t.id === lpMyTicket.id; });
        var waiting = tickets.filter(function (t) { return t.status === "waiting"; });
        var html = "<div class='lp-tabs'>" +
            "<button class='lp-tab" + (!mine || mine.status !== "waiting" ? " on" : "") + "' data-lp-tab='apply'>我要点播</button>" +
            "<button class='lp-tab" + (mine ? " on" : "") + "' data-lp-tab='status'>" +
                (mine ? (mine.status === "approved" ? "拍摄中 🎬" : mine.status === "done" ? "已发布 ✅" : "等待博主接单") : "我的点播") +
            "</button></div>";
        if (mine) {
            html += "<div class='lp-ticket" + (mine.status === "done" ? " boss-done" : "") + "'>" +
                "<span class='t-icon'>" + (mine.status === "done" ? "✅" : mine.status === "approved" ? "🎬" : "🚀") + "</span>" +
                "<div class='t-info'><div class='t-name'>" + mine.rocket + " → " + mine.target + "</div>" +
                "<div class='t-meta'>点播人 " + (mine.name || "匿名") + " · " + mine.time +
                (mine.status === "approved" ? " · 博主正在拍摄" : "") + "</div></div>" +
                (mine.status === "waiting" ? "<div class='t-actions'><button class='t-del' data-lp-del='" + mine.id + "'>撤回点播</button></div>" : "") +
                (mine.status === "done" && mine.video ? "<div class='t-actions'><a class='t-fuse' href='" + mine.video + "' target='_blank' rel='noopener'>▶ 去抖音看视频</a></div>" : "") +
                "</div>";
        }
        html += "<div class='lp-form'>" +
            "<input type='text' id='lpName' maxlength='12' placeholder='你的名字（可留空）' value='" + (store.get("skyarrow_name", "") || "") + "'>" +
            "<select id='lpRocket'>" + LP_ROCKETS.map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select>" +
            "<select id='lpTarget'>" + LP_TARGETS.map(function (t) { return "<option>" + t + "</option>"; }).join("") + "</select>" +
            "<input type='text' id='lpCustom' maxlength='16' placeholder='或自定义火箭名…'>" +
            "<button class='btn-line btn-line--accent' id='lpGo' style='padding:10px 22px'>📡 提交点播</button>" +
            "</div>";
        if (waiting.length > 0) {
            html += "<p class='set-note' style='margin-top:6px'>当前队列：" + waiting.length + " 条待接单 · 博主接单后去拍抖音视频，拍完这里会出现观看链接</p>";
        }
        $("#launchpad").innerHTML = html;
        ["lpRocket", "lpTarget"].forEach(function (id) {
            $("#" + id).addEventListener("change", function () { $("#lpCustom").value = ""; });
        });
        $("#lpGo").addEventListener("click", lpSubmit);
        $("#lpCustom").addEventListener("input", function () {
            if (this.value.trim()) { $("#lpRocket").disabled = true; } else { $("#lpRocket").disabled = false; }
        });
    }

    function lpSubmit() {
        var custom = $("#lpCustom").value.trim();
        var name = $("#lpName").value.trim() || "匿名访客";
        store.set("skyarrow_name", name === "匿名访客" ? "" : name);
        var rocket = custom || $("#lpRocket").value;
        var target = $("#lpTarget").value;
        if (!custom && !rocket) { toast("先选一枚火箭"); return; }
        var tickets = lpGetTickets();
        /* 允许同一用户连续提交多张票，每张独立状态 */
        var ticket = { id: Date.now() + "-" + Math.floor(Math.random() * 9999), name: name, rocket: rocket, target: target, custom: !!custom, time: lpNowTime(), status: "waiting" };
        tickets.unshift(ticket);
        lpSetTickets(tickets);
        lpMyTicket = ticket;
        lpRenderPad();
        toast("点播已提交，等待博主接单拍摄！");
        beep(700, 0.08, "sine", 0.05);
        if (bc) bc.postMessage({ type: "new_ticket" });
        lpNetSend({ type: "new_ticket", ticket: ticket });
    }

    lpListen();
    lpNetSync();
    lpNetListen();
    setInterval(lpNetSync, 5000);
    lpRenderPad();

    /* ================================================================
       v3.0 信息弹窗 helper + v3 通用委托
       ================================================================ */

    function openInfo(kicker, title, html) {
        modalBody.innerHTML = "<p class='m-kicker'>" + kicker + "</p><h3 class='m-title'>" + title + "</h3>" +
            html + "<div class='m-actions'><button class='btn-line' data-modal-close>关闭</button></div>";
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    /* ================================================================
       v3.0 训练中心：六款小游戏
       ================================================================ */

    var gameStage = $("#gameStage");
    var currentGame = "", gameRAF = null, landerRunning = false;
    var typedBuf = "";

    function stopGame() {
        if (gameRAF) { cancelAnimationFrame(gameRAF); gameRAF = null; }
        landerRunning = false;
    }

    function gHead(title, statusId) {
        return "<div class='g-head'><h3>" + title + "</h3><div class='g-status' id='" + statusId + "'>—</div></div>";
    }

    /* ---- 1. 着陆挑战 ---- */
    function buildLander() {
        gameStage.innerHTML = gHead("🚀 着陆挑战", "lStatus") +
            "<canvas class='g-canvas' id='lCanvas' width='640' height='400'></canvas>" +
            "<p class='g-tip'>↑ / W 点火 · ← → / A D 平移 · 垂直速度低于 2.2 m/s 落在平台上才算成功</p>" +
            "<div class='g-actions'><button class='btn-line' id='lStart'>开始 / 重新开始</button></div>";

        var cv = $("#lCanvas"), cx = cv.getContext("2d");
        var W = 640, H = 400, padX = 420, padW = 90;
        var stars = [];
        for (var i = 0; i < 70; i++) stars.push([Math.random() * W, Math.random() * (H - 60), Math.random() * 1.4 + 0.4]);
        var st = { x: 90, y: 40, vx: 0.2, vy: 0, fuel: 100, dead: false, won: false, thrust: false };
        var keys = {};

        function reset() {
            padX = 80 + Math.random() * (W - padW - 160);
            st = { x: 40 + Math.random() * 90, y: 30, vx: Math.random() * 0.6 - 0.3, vy: 0, fuel: 100, dead: false, won: false, thrust: false };
            landerRunning = true;
            $("#lStatus").textContent = "燃料 100 · 垂直速度 0.0 · 水平 0.0";
        }

        function grade() { return st.fuel >= 40 ? "S" : st.fuel >= 20 ? "A" : st.fuel >= 8 ? "B" : "C"; }

        function step() {
            if (landerRunning && !st.dead && !st.won) {
                var up = keys["arrowup"] || keys["w"], lf = keys["arrowleft"] || keys["a"], rt = keys["arrowright"] || keys["d"];
                st.thrust = !!(up && st.fuel > 0);
                st.vy += 0.045;
                if (st.thrust) { st.vy -= 0.115; st.fuel = Math.max(0, st.fuel - 0.55); }
                if (lf) st.vx -= 0.045;
                if (rt) st.vx += 0.045;
                st.vx *= 0.992;
                st.x += st.vx; st.y += st.vy;
                if (st.x < 10) { st.x = 10; st.vx = 0; }
                if (st.x > W - 10) { st.x = W - 10; st.vx = 0; }
                var onPad = st.x > padX - 6 && st.x < padX + padW + 6;
                if (st.y >= H - 26) {
                    st.y = H - 26;
                    if (onPad && st.vy < 2.3 && Math.abs(st.vx) < 1.5) {
                        st.won = true;
                        var g = grade();
                        var wins = store.get("skyarrow_lw", 0) + 1;
                        store.set("skyarrow_lw", wins);
                        var ranks = { C: 1, B: 2, A: 3, S: 4 }, bg = store.get("skyarrow_lg", "C");
                        if (ranks[g] > ranks[bg]) store.set("skyarrow_lg", g);
                        refreshAch(true);
                        toast("着陆成功！评级 " + g + " · 剩余燃料 " + st.fuel.toFixed(0) + "%");
                        beep(660, 0.15, "sine", 0.06); setTimeout(function () { beep(990, 0.25, "sine", 0.06); }, 160);
                    } else {
                        st.dead = true;
                        toast(onPad ? "速度过大，箭体解体 💥" : "偏离平台坠毁 💥（下次瞄准平台）");
                        beep(140, 0.4, "sawtooth", 0.06);
                    }
                }
                $("#lStatus").textContent = "燃料 " + st.fuel.toFixed(0) + " · 垂直 " + st.vy.toFixed(1) + " · 水平 " + st.vx.toFixed(1) + (st.won ? " · 已着陆 " + grade() : st.dead ? " · 任务失败" : "");
            }

            cx.clearRect(0, 0, W, H);
            cx.fillStyle = "#BFE9FF";
            stars.forEach(function (s) { cx.globalAlpha = 0.3 + s[2] / 2; cx.fillRect(s[0], s[1], s[2], s[2]); });
            cx.globalAlpha = 1;
            cx.fillStyle = "#16233F"; cx.fillRect(0, H - 14, W, 14);
            cx.fillStyle = "#6FD6E8"; cx.fillRect(padX, H - 18, padW, 4);
            cx.fillStyle = "#3C5A8A"; cx.font = "10px monospace";
            cx.fillText("LANDING PAD", padX + 8, H - 24);
            cx.save();
            cx.translate(st.x, st.y);
            if (st.thrust) {
                cx.fillStyle = "#FFB347";
                cx.beginPath(); cx.moveTo(-4, 8); cx.lineTo(0, 8 + 10 + Math.random() * 8); cx.lineTo(4, 8); cx.fill();
            }
            cx.fillStyle = st.dead ? "#8A4A4A" : "#E8F4FF";
            cx.fillRect(-4, -12, 8, 20);
            cx.fillStyle = "#6FD6E8"; cx.fillRect(-4, -16, 8, 4);
            cx.restore();
            gameRAF = requestAnimationFrame(step);
        }
        reset(); landerRunning = false;
        step();
        $("#lStart").addEventListener("click", function () { reset(); toast("任务开始，祝好运气！"); });
        window.__landerKeys = keys;
    }

    /* ---- 2. 星空记忆 ---- */
    function buildMemory() {
        var pool = ["🚀", "🛰", "🌕", "☄️", "⭐", "🪐", "🌌", "🔭"];
        var cards = pool.concat(pool).sort(function () { return Math.random() - 0.5; });
        gameStage.innerHTML = gHead("🃏 星空记忆", "mStatus") +
            "<div class='mem-grid'>" + cards.map(function (c, i) {
                return "<div class='mem-card' data-mi='" + i + "'><span>" + c + "</span></div>";
            }).join("") + "</div>" +
            "<p class='g-tip'>翻开两张相同图案即配对成功，用最少步数通关</p>";
        var open = [], matched = 0, moves = 0, lock = false;
        $("#mStatus").textContent = "步数 0 · 已配对 0/8";
        gameStage.querySelectorAll(".mem-card").forEach(function (el) {
            el.addEventListener("click", function () {
                if (lock || el.classList.contains("open") || el.classList.contains("done")) return;
                el.classList.add("open");
                open.push(el);
                beep(640, 0.05, "sine", 0.04);
                if (open.length === 2) {
                    moves++;
                    var a = open[0].querySelector("span").textContent, b = open[1].querySelector("span").textContent;
                    if (a === b) {
                        open.forEach(function (o) { o.classList.add("done"); });
                        open = []; matched++;
                        beep(920, 0.08, "sine", 0.05);
                        if (matched === 8) {
                            var mb = store.get("skyarrow_mem_best", 99);
                            if (moves < mb) store.set("skyarrow_mem_best", moves);
                            refreshAch(true);
                            toast("全部配对完成！共用 " + moves + " 步 🎉"); beep(990, 0.3, "sine", 0.06);
                        }
                    } else {
                        lock = true;
                        setTimeout(function () {
                            open.forEach(function (o) { o.classList.remove("open"); });
                            open = []; lock = false;
                        }, 750);
                    }
                    $("#mStatus").textContent = "步数 " + moves + " · 已配对 " + matched + "/8";
                }
            });
        });
    }

    /* ---- 3. 术语速打 ---- */
    function buildTyping() {
        var WORDS = ["APOLLO", "VOYAGER", "DRAGON", "FALCON", "TIANZHOU", "SHENZHOU", "ORBITER", "LANDING", "THROTTLE", "PAYLOAD", "GRAVITY", "PERIGEE"];
        var idx = 0, t0 = 0, hits = 0, running = false;
        gameStage.innerHTML = gHead("⌨ 术语速打", "tStatus") +
            "<div class='type-word' id='tWord'></div>" +
            "<div class='msg-form' style='max-width:460px;margin:0 auto'><input type='text' id='tInput' autocomplete='off' placeholder='对照上方单词输入，回车重开'></div>" +
            "<p class='g-tip'>打完 8 个航天术语，按字符数 / 用时计算速度</p>" +
            "<div class='g-actions'><button class='btn-line' id='tStart'>开始</button></div>";

        function renderWord() {
            var w = WORDS[idx], input = $("#tInput").value.toUpperCase(), html = "";
            for (var i = 0; i < w.length; i++) {
                if (i < input.length) html += input[i] === w[i] ? "<b>" + w[i] + "</b>" : "<u style='color:#E58A8A'>" + w[i] + "</u>";
                else if (i === input.length) html += "<u>" + w[i] + "</u>";
                else html += w[i];
            }
            $("#tWord").innerHTML = html;
            $("#tStatus").textContent = running ? "第 " + (idx + 1) + "/8 词 · 已打 " + hits + " 字符" : "按「开始」启动";
        }

        function next() {
            idx++;
            if (idx >= 8) {
                running = false;
                var sec = (Date.now() - t0) / 1000;
                var wpm = (hits / 5) / (sec / 60);
                var wpmBest = store.get("skyarrow_type_best", 0);
                if (wpm > wpmBest) store.set("skyarrow_type_best", Math.round(wpm));
                refreshAch(true);
                $("#tStatus").textContent = "完成！用时 " + sec.toFixed(1) + "s · 速度 " + wpm.toFixed(0) + " WPM";
                toast("速打完成：" + wpm.toFixed(0) + " WPM" + (wpm > 40 ? "，可以当测控打字员了" : ""));
                $("#tWord").textContent = "🎉 任务完成";
                return;
            }
            $("#tInput").value = "";
            renderWord();
        }

        $("#tStart").addEventListener("click", function () {
            idx = 0; hits = 0; running = true; t0 = Date.now();
            $("#tInput").value = ""; $("#tInput").focus();
            renderWord();
        });
        $("#tInput").addEventListener("input", function () {
            if (!running) return;
            hits++;
            if ($("#tInput").value.toUpperCase() === WORDS[idx]) next();
            else renderWord();
        });
        $("#tInput").addEventListener("keydown", function (e) {
            if (e.key === "Enter") { idx = 0; hits = 0; running = true; t0 = Date.now(); $("#tInput").value = ""; renderWord(); }
        });
        renderWord();
    }

    /* ---- 4. 反应测试 ---- */
    function buildReact() {
        var state = "idle", goTs = 0, armTimer = null;
        gameStage.innerHTML = gHead("⚡ 反应测试", "rStatus") +
            "<div style='display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:20px'>" +
            "<div class='react-lamp' id='rLamp'>🚦</div>" +
            "<p class='g-tip' style='margin-top:0'>红灯亮起后等待，变绿的瞬间点击圆灯。抢点记失败。</p>" +
            "<div class='g-actions'><button class='btn-line' id='rGo'>开始</button></div></div>";
        var best = store.get("skyarrow_react_best", 0);
        function stat(s) { $("#rStatus").textContent = s + (best ? " · 最佳 " + best + " ms" : ""); }
        stat("就绪");
        $("#rGo").addEventListener("click", function () {
            state = "armed"; stat("等待变绿…");
            $("#rLamp").className = "react-lamp"; $("#rLamp").textContent = "🚦";
            clearTimeout(armTimer);
            armTimer = setTimeout(function () {
                state = "go"; goTs = performance.now();
                $("#rLamp").classList.add("go"); $("#rLamp").textContent = "🟢";
                beep(1200, 0.08, "sine", 0.05);
            }, 1200 + Math.random() * 2300);
        });
        $("#rLamp").addEventListener("click", function () {
            if (state === "armed") {
                clearTimeout(armTimer); state = "idle";
                stat("抢点啦！红灯时不能点"); toast("手太快了，重新来");
                beep(200, 0.2, "square", 0.05);
            } else if (state === "go") {
                var ms = Math.round(performance.now() - goTs);
                state = "idle";
                if (!best || ms < best) { best = ms; store.set("skyarrow_react_best", ms); }
                refreshAch(true);
                stat("反应 " + ms + " ms" + (ms < 250 ? "（航天员级！）" : ms < 350 ? "（优秀）" : "（继续练）"));
                $("#rLamp").className = "react-lamp"; $("#rLamp").textContent = "✅";
                beep(880, 0.1, "sine", 0.05);
            }
        });
    }

    /* ---- 5. 星际 2048 ---- */
    function build2048() {
        var grid, score, won, over;
        gameStage.innerHTML = gHead("🔢 星际 2048", "sStatus") +
            "<div class='g2048-grid' id='sGrid'></div>" +
            "<p class='g-tip'>方向键（↑↓←→）滑动合并数字，凑出 2048 号「火箭」</p>" +
            "<div class='g-actions'><button class='btn-line' id='sNew'>新开一局</button></div>";

        function addRand() {
            var empty = [];
            grid.forEach(function (row, r) { row.forEach(function (v, c) { if (!v) empty.push([r, c]); }); });
            if (!empty.length) return;
            var p = empty[Math.floor(Math.random() * empty.length)];
            grid[p[0]][p[1]] = Math.random() < 0.9 ? 2 : 4;
        }
        function render() {
            $("#sGrid").innerHTML = "";
            grid.forEach(function (row) {
                row.forEach(function (v) {
                    var d = document.createElement("div");
                    d.className = "g2048-cell" + (v ? " v" + Math.min(v, 2048) : "");
                    d.textContent = v || "";
                    $("#sGrid").appendChild(d);
                });
            });
            $("#sStatus").textContent = "得分 " + score + (won ? " · 🎉 已达 2048" : over ? " · 无路可走" : "");
            var mx = 0;
            grid.forEach(function (row) { row.forEach(function (v) { if (v > mx) mx = v; }); });
            if (mx > store.get("skyarrow_2048_max", 0)) store.set("skyarrow_2048_max", mx);
            refreshAch(true);
        }
        function alive() {
            for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
                if (!grid[r][c]) return true;
                if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
                if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
            }
            return false;
        }
        function slide(row) {
            var a = row.filter(function (v) { return v; });
            for (var i = 0; i < a.length - 1; i++) {
                if (a[i] === a[i + 1]) { a[i] *= 2; score += a[i]; a.splice(i + 1, 1); }
            }
            while (a.length < 4) a.push(0);
            return a;
        }
        function move(dir) {
            if (over) return;
            var before = JSON.stringify(grid);
            var cols = [0, 1, 2, 3].map(function (c) { return grid.map(function (row) { return row[c]; }); });
            if (dir === "l") grid = grid.map(slide);
            if (dir === "r") grid = grid.map(function (row) { return slide(row.slice().reverse()).reverse(); });
            if (dir === "u") cols = cols.map(slide);
            if (dir === "d") cols = cols.map(function (col) { return slide(col.slice().reverse()).reverse(); });
            if (dir === "u" || dir === "d") grid = [0, 1, 2, 3].map(function (r) { return cols.map(function (col) { return col[r]; }); });
            if (JSON.stringify(grid) === before) return;
            addRand();
            if (grid.some(function (row) { return row.indexOf(2048) !== -1; }) && !won) { won = true; toast("🎉 2048 组装完成！可以继续冲更高"); beep(990, 0.3, "sine", 0.06); }
            if (!alive()) { over = true; toast("无路可走了，最终得分 " + score); beep(180, 0.3, "square", 0.05); }
            render();
        }
        $("#sNew").addEventListener("click", function () {
            grid = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
            score = 0; won = false; over = false;
            addRand(); addRand(); render();
        });
        move2048 = move;
        $("#sNew").click();
    }

    /* ---- 6. 碎片扫雷 ---- */
    function buildMines() {
        var N = 8, MINES = 10;
        var cells, started, dead;
        gameStage.innerHTML = gHead("💣 碎片扫雷", "xStatus") +
            "<div class='mine-grid' id='xGrid'></div>" +
            "<p class='g-tip'>左键翻开 · 右键插旗 🚩 · 首点保证安全 · 排除全部 10 枚碎片残骸即胜利</p>" +
            "<div class='g-actions'><button class='btn-line' id='xNew'>再来一局</button></div>";

        function stat() { $("#xStatus").textContent = "已翻开 " + cells.filter(function (c) { return c.open; }).length + "/54" + (dead ? " · 引爆" : ""); }

        function neighbors(i) {
            var r = Math.floor(i / N), c = i % N, out = [];
            for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
                var nr = r + dr, nc = c + dc;
                if ((dr || dc) && nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
            }
            return out;
        }

        function render() {
            var g = $("#xGrid");
            g.innerHTML = "";
            cells.forEach(function (c, i) {
                var d = document.createElement("div");
                d.className = "mine-cell" + (c.open ? " open" : "") + (c.flag ? " flag" : "") + (c.open && c.mine ? " boom" : "");
                d.textContent = c.open ? (c.mine ? "💥" : (c.n || "")) : (c.flag ? "🚩" : "");
                d.setAttribute("data-xi", i);
                g.appendChild(d);
            });
            stat();
        }

        function place(safe) {
            var banned = [safe].concat(neighbors(safe)), placed = 0;
            cells = [];
            for (var i = 0; i < N * N; i++) cells.push({ mine: false, open: false, flag: false, n: 0 });
            while (placed < MINES) {
                var p = Math.floor(Math.random() * N * N);
                if (banned.indexOf(p) === -1 && !cells[p].mine) { cells[p].mine = true; placed++; }
            }
            cells.forEach(function (c, i) { c.n = neighbors(i).filter(function (j) { return cells[j].mine; }).length; });
        }

        function flood(i) {
            var q = [i];
            while (q.length) {
                var j = q.pop(), c = cells[j];
                if (c.open || c.flag) continue;
                c.open = true;
                if (c.n === 0 && !c.mine) neighbors(j).forEach(function (k) { if (!cells[k].open) q.push(k); });
            }
        }

        function openCell(i) {
            if (dead || cells[i].open || cells[i].flag) return;
            if (!started) { place(i); started = true; }
            if (cells[i].mine) {
                dead = true;
                cells.forEach(function (c) { if (c.mine) c.open = true; });
                render();
                toast("碰到残骸了 💥 再来一局");
                beep(140, 0.4, "sawtooth", 0.06);
                return;
            }
            flood(i);
            beep(560, 0.04, "sine", 0.03);
            var opened = cells.filter(function (c) { return c.open; }).length;
            if (opened === N * N - MINES) { toast("排雷成功！凌箭发射场安全了 🎉"); beep(990, 0.3, "sine", 0.06); }
            render();
        }

        $("#xGrid").addEventListener("click", function (e) {
            var d = e.target.closest("[data-xi]");
            if (d) openCell(+d.getAttribute("data-xi"));
        });
        $("#xGrid").addEventListener("contextmenu", function (e) {
            e.preventDefault();
            var d = e.target.closest("[data-xi]");
            if (!d || dead) return;
            var i = +d.getAttribute("data-xi");
            if (!cells[i].open) { cells[i].flag = !cells[i].flag; render(); beep(760, 0.05, "sine", 0.04); }
        });
        $("#xNew").addEventListener("click", function () { cells = []; started = false; dead = false; place(0); started = false; cells.forEach(function (c) { c.open = false; }); render(); });
        $("#xNew").click();
    }

    var GAME_BUILDERS = { lander: buildLander, memory: buildMemory, typing: buildTyping, react: buildReact, g2048: build2048, mines: buildMines };

    function openGame(name) {
        stopGame();
        currentGame = name;
        GAME_BUILDERS[name]();
    }

    $("#gameTabs").addEventListener("click", function (e) {
        var chip = e.target.closest("[data-game]");
        if (!chip) return;
        $$("#gameTabs .chip").forEach(function (c) { c.classList.toggle("active", c === chip); });
        openGame(chip.getAttribute("data-game"));
        beep(700, 0.05, "sine", 0.04);
    });
    openGame("lander");

    /* 游戏键盘：着陆 */
    window.addEventListener("keydown", function (e) {
        if (currentGame !== "lander" || !landerRunning) return;
        var k = e.key.toLowerCase();
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].indexOf(k) !== -1) {
            window.__landerKeys[k] = true;
            if (k !== "arrowdown" && k !== "s") e.preventDefault();
        }
    });
    window.addEventListener("keyup", function (e) {
        if (currentGame !== "lander") return;
        window.__landerKeys[e.key.toLowerCase()] = false;
    });

    /* 游戏键盘：2048 */
    window.addEventListener("keydown", function (e) {
        if (currentGame !== "g2048") return;
        var map = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d" };
        if (!map[e.key]) return;
        e.preventDefault();
        move2048(map[e.key]);
    });
    var move2048 = function () {};

    /* ================================================================
       v3.0 功能总览（108 项索引）
       ================================================================ */

    var FEATURES = [
        ["站点基础", [
            ["开屏加载动画", "#home"], ["顶部滚动进度条", ""], ["粘性导航栏", ""],
            ["全屏菜单覆盖层（M）", ""], ["分区导航点", ""], ["左下分区 HUD", ""],
            ["返回顶部（T）", ""], ["滚动显现动画", ""], ["界面音效开关（P）", ""],
            ["全局搜索弹窗（S）", ""], ["图片灯箱 · 左右切换", "#falcon9"], ["灯箱原图下载", "#falcon9"],
            ["任务详情弹窗", "#archive"], ["全局 toast 提示", ""], ["分享复制文案", "#archive"],
            ["任务收藏系统（★）", "#archive"], ["平滑锚点滚动", ""]
        ]],
        ["首页体验", [
            ["星空粒子背景", "#home"], ["下次任务倒计时", "#home"], ["模拟点火彩蛋 🚀", "#home"],
            ["统计数字滚动动画", "#home"], ["打字机循环标语", "#home"], ["下滑提示箭头", "#home"],
            ["标签页离开标题彩蛋", ""]
        ]],
        ["任务内容", [
            ["长征七号 · 天舟夜射", "#cz7"], ["长征八号 · 首飞复刻", "#cz8"],
            ["乳齿象发动机 · 热试车", "#mammoth"], ["猎鹰9号 · 载人龙", "#falcon9"],
            ["12 条任务档案", "#archive"], ["档案 7 类筛选", "#archive"], ["档案实时搜索", "#archive"],
            ["档案图集灯箱", "#archive"], ["任务参数详情", "#archive"], ["任务时间线详情", "#archive"],
            ["筹备中任务预告", "#archive"], ["每日星图", "#square"], ["星图换一张", "#square"],
            ["星图查看大图", "#square"], ["星图自动播放", "#square"]
        ]],
        ["航天工具", [
            ["轨道计算器", "#tools"], ["火箭对比器", "#tools"], ["11 枚火箭参数库", "#tools"],
            ["表头点击排序", "#tools"], ["参数库搜索", "#tools"], ["对比优势高亮", "#tools"]
        ]],
        ["航天实验室", [
            ["重力体重换算", "#lab"], ["行星年龄计算", "#lab"], ["光速旅行时间", "#lab"],
            ["Δv 火箭方程", "#lab"], ["燃料质量比", "#lab"], ["万能单位换算", "#lab"],
            ["逃逸速度查询", "#lab"], ["圆轨道速度表", "#lab"], ["运力条形图", "#lab"], ["发射窗口日历", "#lab"]
        ]],
        ["观星台", [
            ["今日月相计算", "#sky"], ["任意日期月相查询", "#sky"], ["星座图鉴 ×8", "#sky"],
            ["太阳系天体卡 ×10", "#sky"], ["星座/天体详情弹窗", "#sky"], ["流星雨日历", "#sky"],
            ["流星雨月份筛选", "#sky"], ["流星雨参数表", "#sky"]
        ]],
        ["模拟训练中心", [
            ["着陆挑战（推力控制）", "#games"], ["星空记忆翻牌", "#games"], ["术语速打 WPM", "#games"],
            ["反应速度测试", "#games"], ["星际 2048", "#games"], ["碎片扫雷", "#games"]
        ]],
        ["航天文库", [
            ["航天术语词典 ×20", "#knowledge"], ["词典实时搜索", "#knowledge"], ["术语详情弹窗", "#knowledge"],
            ["太空冷知识翻牌 ×12", "#knowledge"], ["历史上的今天", "#knowledge"], ["历史事件换一条", "#knowledge"],
            ["火箭结构解析 ×6", "#knowledge"], ["航天测验 ×10 题", "#archive"], ["测验评分与重开", "#archive"]
        ]],
        ["凌箭驿站", [
            ["留言板", "#community"], ["留言昵称署名", "#community"], ["留言删除", "#community"],
            ["最爱火箭投票", "#community"], ["投票百分比条", "#community"], ["任务点赞墙", "#community"]
        ]],
        ["无限生成中心", [
            ["随机任务生成器", "#dock"], ["任务运力校核", "#dock"], ["任务成功指数", "#dock"], ["任务编号系统", "#dock"],
            ["星系扫描器（2³² 种子）", "#dock"], ["系外行星宜居判定", "#dock"], ["火箭拼装厂", "#dock"], ["火箭运力估算", "#dock"],
            ["我的设计本", "#dock"], ["成就墙 ×29", "#dock"], ["解锁进度统计", "#dock"], ["生成空间计数（真实乘积）", "#dock"]
        ]],
        ["发射点播系统", [
            ["发射点播台", "#dock"], ["自定义火箭点播", "#dock"], ["点播队列", "#dock"], ["点播撤回", "#dock"],
            ["博主接单台（独立页/EXE）", ""], ["博主接单拍摄", ""], ["抖音视频链接回填", ""], ["跨网络实时联动（ntfy 消息）", "#dock"],
            ["Windows 接单通知", ""], ["Windows 发布通知", ""], ["视频观看按钮", "#dock"], ["博主清空记录", ""]
        ]],
        ["弹幕广场", [
            ["发射弹幕", "#square"], ["弹幕回放", "#square"], ["弹幕清空", "#square"]
        ]],
        ["个性设置", [
            ["主题切换 ×3", ""], ["字号三档", ""], ["动效减弱开关", ""], ["音效试听板 ×6", ""],
            ["昵称设置", ""], ["倒计时自定义", ""], ["数据导出 JSON", ""], ["数据导入", ""],
            ["一键清空本机数据", ""], ["全屏模式", ""], ["打印任务单", ""],
            ["访问计数徽标", ""], ["在线时长计时", ""]
        ]],
        ["彩蛋与效率", [
            ["世界时钟 ×3 时区", ""], ["鼠标坐标雷达", ""], ["挂机屏保", ""], ["Konami 码星雨", ""],
            ["logo 连点 SRE 模式", ""], ["输入 SKYARROW 暗号", ""], ["控制台欢迎彩蛋", ""],
            ["快捷键帮助（?）", ""], ["卡片 3D 倾斜", ""]
        ]]
    ];

    var FEAT_FLAT = [];
    FEATURES.forEach(function (g) {
        g[1].forEach(function (it) { FEAT_FLAT.push({ g: g[0], n: it[0], go: it[1] || "" }); });
    });
    FEAT_FLAT.forEach(function (f, i) { f.no = i + 1; });

    function renderFeatList(kw) {
        kw = (kw || "").trim().toLowerCase();
        var shown = FEAT_FLAT.filter(function (f) { return !kw || f.n.toLowerCase().indexOf(kw) !== -1; });
        var html = "", lastG = "";
        shown.forEach(function (f) {
            if (f.g !== lastG) { html += "<div class='feat-group'>" + f.g + "</div>"; lastG = f.g; }
            html += "<button class='feat-item' data-go='" + f.go + "'><span class='f-no'>" + String(f.no).padStart(3, "0") + "</span><span class='f-name'>" + f.n + "</span>" + (f.go ? "<span class='f-go'>↗</span>" : "") + "</button>";
        });
        $("#featList").innerHTML = html || "<p class='db-empty'>没有匹配的功能</p>";
        $("#featCount").textContent = "共 " + FEAT_FLAT.length + " 项 · 显示 " + shown.length + " 项";
    }

    function openFeatures() {
        modalBody.innerHTML = "<p class='m-kicker'>FEATURES</p><h3 class='m-title'>功能总览 · 固定功能 " + FEAT_FLAT.length + " 项</h3>" +
            "<div class='feat-toolbar'><input type='search' class='arch-search' id='featSearch' placeholder='搜索功能名称…' style='flex:1;min-width:200px'>" +
            "<span class='feat-count' id='featCount'></span></div>" +
            "<div class='feat-list' id='featList'></div>" +
            "<p class='set-note' style='margin-top:14px;color:#E8C46F'>♾ 另有生成式功能空间（实时演算，非写死）：任务 " +
            GM_COMBOS.toLocaleString() + " 种 + 火箭 " + GR_COMBOS.toLocaleString() + " 种 + 星系种子 4,294,967,296 种，入口在「无限任务中心」。</p>" +
            "<p class='set-note' style='margin-top:8px'>快捷键：M 菜单 · S 搜索 · T 回顶部 · P 音效 · ? 功能总览 · Esc 关闭一切。点击条目可跳到对应区块。</p>";
        renderFeatList("");
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        $("#featSearch").addEventListener("input", function () { renderFeatList($("#featSearch").value); });
    }

    /* ================================================================
       v3.0 个性设置
       ================================================================ */

    function segHtml(kind, opts, cur) {
        return "<div class='seg'>" + opts.map(function (o) {
            return "<button data-set='" + kind + "' data-v='" + o[0] + "'" + (o[0] === cur ? " class='on'" : "") + ">" + o[1] + "</button>";
        }).join("") + "</div>";
    }

    function openSettings() {
        var th = store.get("skyarrow_theme", "blue");
        var ft = store.get("skyarrow_font", "base");
        var mo = store.get("skyarrow_motion", "on");
        modalBody.innerHTML = "<p class='m-kicker'>SETTINGS</p><h3 class='m-title'>个性设置</h3><div class='set-grid'>" +
            "<div class='set-row'><span class='s-label'>主题</span>" + segHtml("theme", [["blue", "深空蓝"], ["black", "曜石黑"], ["purple", "暗夜紫"]], th) + "</div>" +
            "<div class='set-row'><span class='s-label'>字号</span>" + segHtml("font", [["base", "标准"], ["large", "大"], ["xlarge", "特大"]], ft) + "</div>" +
            "<div class='set-row'><span class='s-label'>动效</span>" + segHtml("motion", [["on", "开"], ["off", "减弱"]], mo) + "</div>" +
            "<div class='set-row'><span class='s-label'>音效试听</span>" +
            [1, 2, 3, 4, 5, 6].map(function (i) { return "<button class='snd-btn' data-snd='" + i + "'>" + ["点火", "确认", "成功", "失败", "滴答", "扫描"][i - 1] + "</button>"; }).join("") + "</div>" +
            "<div class='set-row'><span class='s-label'>我的昵称</span><div class='msg-form' style='margin:0;flex:1'><input type='text' id='setName' maxlength='12' placeholder='留言板署名' value='" + (store.get("skyarrow_name", "") || "") + "'><button class='btn-line' id='setNameGo'>保存</button></div></div>" +
            "<div class='set-row'><span class='s-label'>倒计时</span><div class='msg-form' style='margin:0;flex:1'><input type='datetime-local' id='setCdInput'><button class='btn-line' id='setCdGo'>更新任务时间</button></div></div>" +
            "<div class='set-row'><span class='s-label'>本机数据</span>" +
            "<button class='btn-line' id='expJson'>导出 JSON</button><input type='file' id='impJson' accept='.json,application/json' style='max-width:180px;font-size:12px'>" +
            "<button class='btn-line set-danger' id='wipeAll'>清空全部数据</button></div>" +
            "<div class='set-row'><span class='s-label'>视图</span>" +
            "<button class='btn-line' id='fsBtn'>⛶ 全屏切换</button><button class='btn-line' id='printBtn'>🖨 打印本页</button></div>" +
            "<p class='set-note'>所有设置与数据都保存在本机浏览器（localStorage），不上传任何服务器。「清空全部数据」会同时清掉收藏、弹幕、留言与游戏记录。</p></div>";
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function applySet(btn) {
        var kind = btn.getAttribute("data-set"), v = btn.getAttribute("data-v");
        $$("[data-set='" + kind + "']").forEach(function (b) { b.classList.toggle("on", b === btn); });
        if (kind === "theme") {
            document.body.classList.remove("theme-black", "theme-purple");
            if (v !== "blue") document.body.classList.add("theme-" + v);
            store.set("skyarrow_theme", v);
        }
        if (kind === "font") {
            document.body.classList.remove("font-large", "font-xlarge");
            if (v !== "base") document.body.classList.add("font-" + v);
            store.set("skyarrow_font", v);
        }
        if (kind === "motion") {
            document.body.classList.toggle("no-motion", v === "off");
            store.set("skyarrow_motion", v);
        }
        beep(760, 0.05, "sine", 0.04);
    }

    function exportData() {
        var out = {};
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k.indexOf("skyarrow_") === 0) out[k] = localStorage.getItem(k);
        }
        var blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "skyarrow-data.json";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 800);
        toast("本机数据已导出为 JSON");
    }

    function importData(file) {
        if (!file) return;
        var fr = new FileReader();
        fr.onload = function () {
            try {
                var obj = JSON.parse(fr.result);
                Object.keys(obj).forEach(function (k) {
                    if (k.indexOf("skyarrow_") === 0) localStorage.setItem(k, obj[k]);
                });
                toast("导入成功，即将刷新页面");
                setTimeout(function () { location.reload(); }, 900);
            } catch (e) { toast("文件解析失败，请选择导出的 JSON"); }
        };
        fr.readAsText(file);
    }

    function wipeData() {
        if (!confirm("确定清空全部本机数据？（收藏 / 弹幕 / 留言 / 游戏记录 / 设置）")) return;
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k.indexOf("skyarrow_") === 0) keys.push(k);
        }
        keys.forEach(function (k) { localStorage.removeItem(k); });
        toast("已清空，即将刷新页面");
        setTimeout(function () { location.reload(); }, 900);
    }

    function playSnd(i) {
        if (i === 1) { beep(160, 0.5, "sawtooth", 0.06); setTimeout(function () { beep(110, 0.8, "sawtooth", 0.05); }, 180); }
        if (i === 2) beep(880, 0.12, "sine", 0.06);
        if (i === 3) { beep(660, 0.12, "sine", 0.06); setTimeout(function () { beep(990, 0.25, "sine", 0.06); }, 140); }
        if (i === 4) beep(160, 0.35, "square", 0.05);
        if (i === 5) beep(1200, 0.05, "square", 0.03);
        if (i === 6) { beep(400, 0.08, "sine", 0.04); setTimeout(function () { beep(700, 0.08, "sine", 0.04); }, 90); setTimeout(function () { beep(1000, 0.1, "sine", 0.04); }, 180); }
    }

    /* ================================================================
       v3.0 状态徽标 / 世界时钟 / 屏保 / 彩蛋
       ================================================================ */

    /* 访问计数 */
    var visits = store.get("skyarrow_visits", 0) + 1;
    store.set("skyarrow_visits", visits);

    /* 徽标 */
    var badge = document.createElement("div");
    badge.className = "hud v3-badge";
    badge.style.cssText = "left:18px;bottom:88px;right:auto;flex-direction:column;align-items:flex-start;gap:2px;font-size:11px;opacity:.85";
    badge.innerHTML = "<span id='bdVisit'>🛰 第 " + visits + " 次来访 · 在线 00:00</span>" +
        "<span id='bdClock'>UTC --:-- · NYC --:--</span>" +
        "<span id='bdMouse'>🖱 -- · --</span>";
    var hudEl = $("#hud");
    if (hudEl && hudEl.parentNode) hudEl.parentNode.insertBefore(badge, hudEl);
    else document.body.appendChild(badge);

    var t0Session = Date.now();
    setInterval(function () {
        var s = Math.floor((Date.now() - t0Session) / 1000);
        var mm = String(Math.floor(s / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
        var bv = $("#bdVisit");
        if (bv) bv.textContent = "🛰 第 " + visits + " 次来访 · 在线 " + mm + ":" + ss;
        var utc = new Date().toLocaleTimeString("zh-CN", { hour12: false, timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
        var nyc = new Date().toLocaleTimeString("zh-CN", { hour12: false, timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
        var bc = $("#bdClock");
        if (bc) bc.textContent = "UTC " + utc + " · NYC " + nyc;
    }, 1000);

    var mouseThrottle = 0;
    document.addEventListener("mousemove", function (e) {
        var now = Date.now();
        if (now - mouseThrottle < 120) return;
        mouseThrottle = now;
        var bm = $("#bdMouse");
        if (bm) bm.textContent = "🖱 " + e.clientX + " · " + e.clientY;
    });

    /* 屏保（60 秒无操作） */
    var screensaverOn = false, ssTimer = null;
    var ssEl = document.createElement("div");
    ssEl.className = "screensaver";
    ssEl.innerHTML = "<div class='ss-rocket'>🛰</div><p>凌箭屏保 · 航天器巡航中</p><p style='font-size:11px'>移动鼠标或按任意键返回</p>";
    document.body.appendChild(ssEl);

    function setScreensaver(on) {
        screensaverOn = on;
        ssEl.classList.toggle("on", on);
        if (!on) resetIdle();
    }
    function resetIdle() {
        clearTimeout(ssTimer);
        ssTimer = setTimeout(function () { setScreensaver(true); }, 60000);
    }
    var lastIdleReset = 0;
    ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(function (ev) {
        document.addEventListener(ev, function () {
            if (screensaverOn) { setScreensaver(false); return; }
            var now = Date.now();
            if (now - lastIdleReset < 500) return;
            lastIdleReset = now;
            resetIdle();
        }, { passive: true });
    });
    resetIdle();

    /* 标签页离开标题彩蛋 */
    var baseTitle = document.title;
    document.addEventListener("visibilitychange", function () {
        document.title = document.hidden ? "🚀 别走！任务还在等你回来" : baseTitle;
    });

    /* 打字机循环标语 */
    var tw = document.createElement("p");
    tw.id = "typewriter";
    tw.style.cssText = "color:var(--cyan,#6FD6E8);letter-spacing:3px;font-size:14px;min-height:22px;margin-top:18px";
    var heroBadges = $(".hero-badges");
    if (heroBadges && heroBadges.parentNode) heroBadges.parentNode.insertBefore(tw, heroBadges.nextSibling);

    var TW_LINES = [
        "凌云之志 · 一箭入轨",
        "用三个文件，装下一整座发射场",
        "SFS 与 KSP，双修不偏科",
        "下一次点火，就在倒计时归零时",
        "写代码的人，也在造火箭"
    ];
    var twI = 0, twC = 0, twDel = false;
    (function typeLoop() {
        if (!tw.isConnected) return;
        var line = TW_LINES[twI];
        twC += twDel ? -1 : 1;
        tw.textContent = line.slice(0, twC) + (twDel ? "" : "▌");
        var delay = twDel ? 40 : 110;
        if (!twDel && twC >= line.length) { twDel = true; delay = 2200; }
        if (twDel && twC <= 0) { twDel = false; twI = (twI + 1) % TW_LINES.length; delay = 400; }
        setTimeout(typeLoop, delay);
    })();

    /* 卡片 3D 倾斜 */
    function bindTilt(containerSel, cardSel) {
        var box = $(containerSel);
        if (!box) return;
        box.addEventListener("mousemove", function (e) {
            if (document.body.classList.contains("no-motion")) return;
            var card = e.target.closest(cardSel);
            if (!card) return;
            var r = card.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - 0.5;
            var py = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = "perspective(600px) rotateY(" + (px * 6).toFixed(2) + "deg) rotateX(" + (-py * 6).toFixed(2) + "deg)";
        });
        box.addEventListener("mouseleave", function (e) {
            var card = e.target.closest && e.target.closest(cardSel);
            if (card) card.style.transform = "";
        });
        box.addEventListener("mouseout", function (e) {
            var card = e.target.closest(cardSel);
            if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
        });
    }
    bindTilt("#archGrid", ".arch-card");
    bindTilt("#labGrid", ".lab-card");
    bindTilt(".about-cards", ".about-card");

    /* 星雨（Konami / SKYARROW 暗号共用） */
    function starRain(n) {
        for (var i = 0; i < (n || 40); i++) {
            (function (i) {
                var s = document.createElement("span");
                s.textContent = "🚀";
                s.style.cssText = "position:fixed;z-index:890;top:-40px;left:" + (Math.random() * 100) + "vw;font-size:" + (16 + Math.random() * 20) + "px;pointer-events:none";
                document.body.appendChild(s);
                s.animate(
                    [{ transform: "translateY(-40px) rotate(-10deg)" }, { transform: "translateY(110vh) rotate(" + (240 + Math.random() * 240) + "deg)" }],
                    { duration: 2200 + Math.random() * 2200, delay: i * 60, easing: "cubic-bezier(.4,0,.9,.4)" }
                ).onfinish = function () { s.remove(); };
            })(i);
        }
    }

    /* Konami 码 */
    var konamiSeq = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
    var konamiBuf = [];
    document.addEventListener("keydown", function (e) {
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
        konamiBuf.push(e.key.toLowerCase());
        konamiBuf = konamiBuf.slice(-10);
        if (konamiBuf.join(",") === konamiSeq.join(",")) {
            konamiBuf = [];
            starRain(50);
            toast("🛸 Konami 秘技触发！箭群升空");
            beep(880, 0.15, "sine", 0.06);
        }
    });

    /* logo 连点 5 次 */
    var logoClicks = 0, logoTimer = null;
    $(".nav-logo-link").addEventListener("click", function () {
        logoClicks++;
        clearTimeout(logoTimer);
        logoTimer = setTimeout(function () { logoClicks = 0; }, 1600);
        if (logoClicks >= 5) {
            logoClicks = 0;
            document.body.animate(
                [{ filter: "hue-rotate(0deg)" }, { filter: "hue-rotate(360deg)" }],
                { duration: 2600, easing: "linear" }
            );
            toast("🔧 SRE 模式：全站校色巡检完成");
            console.log("%c[SKYARROW SRE] 色彩管线检查 OK · 3 files · 0 error", "color:#6FD6E8");
        }
    });

    /* 控制台欢迎 */
    console.log("%c凌箭航天 SKYARROW%c\n%c三件套官网 · " + FEAT_FLAT.length + " 项功能 · 由 index.html + style.css + main.js 构建\n按 ? 查看功能总览，试试输入 skyarrow 暗号。",
        "color:#6FD6E8;font-size:22px;font-weight:bold;letter-spacing:4px",
        "",
        "color:#8fa8c8;font-size:12px");

    /* ================================================================
       v3.0 全局委托（信息卡 / 功能索引 / 设置控件）
       ================================================================ */

    document.addEventListener("click", function (e) {
        var t;

        if (e.target.closest("[data-features]")) { closeModal(); setTimeout(openFeatures, 120); return; }
        if (e.target.closest("[data-settings]")) { closeModal(); setTimeout(openSettings, 120); return; }
        if ((t = e.target.closest("[data-lp-del]"))) {
            var delId = t.getAttribute("data-lp-del");
            lpSetTickets(lpGetTickets().filter(function (x) { return x.id !== delId; }));
            if (lpMyTicket && lpMyTicket.id === delId) lpMyTicket = null;
            lpRenderPad();
            if (bc) bc.postMessage({ type: "tickets_changed" });
            toast("已撤回点播");
            return;
        }

        if ((t = e.target.closest("[data-const]"))) {
            var c = CONSTS[+t.getAttribute("data-const")];
            openInfo("CONSTELLATION", c[1] + " · " + c[2], "<p class='m-desc'>" + c[3] + "</p><p class='m-desc'>最佳观赏期：<b>" + c[4] + "</b></p>");
            return;
        }
        if ((t = e.target.closest("[data-planet]"))) {
            var p = PLANETS[+t.getAttribute("data-planet")];
            openInfo("SOLAR SYSTEM", p[1] + " · " + p[2],
                "<p class='m-desc'>" + p[8] + "</p><div class='m-specs'>" +
                "<div><span>直径</span><b>" + p[3] + " km</b></div>" +
                "<div><span>距太阳</span><b>" + p[4] + "</b></div>" +
                "<div><span>自转周期</span><b>" + p[5] + "</b></div>" +
                "<div><span>公转周期</span><b>" + p[6] + "</b></div>" +
                "<div><span>卫星数</span><b>" + p[7] + "</b></div></div>");
            return;
        }
        if ((t = e.target.closest("[data-term]"))) {
            var tm = TERMS[+t.getAttribute("data-term")];
            openInfo("GLOSSARY · " + tm[1], tm[0], "<p class='m-desc'>" + tm[2] + "</p>");
            return;
        }
        if ((t = e.target.closest("[data-part]"))) {
            var pt = PARTS[+t.getAttribute("data-part")];
            openInfo("ROCKET PARTS", pt[1], "<p class='m-desc'>" + pt[2] + "</p>");
            return;
        }
        if ((t = e.target.closest(".fact-card"))) {
            t.classList.toggle("flipped");
            beep(700, 0.05, "sine", 0.04);
            return;
        }
        if ((t = e.target.closest(".feat-item"))) {
            var go = t.getAttribute("data-go");
            if (go) {
                var fo = store.get("skyarrow_feat_opens", 0) + 1;
                store.set("skyarrow_feat_opens", fo);
                refreshAch(true);
            }
            closeModal();
            if (go) setTimeout(function () {
                var el = document.querySelector(go);
                if (el) el.scrollIntoView({ behavior: "smooth" });
            }, 160);
            return;
        }
        if ((t = e.target.closest("[data-set]"))) { applySet(t); return; }
        if ((t = e.target.closest("[data-snd]"))) { playSnd(+t.getAttribute("data-snd")); return; }
        if (e.target.closest("#expJson")) { exportData(); return; }
        if (e.target.closest("#wipeAll")) { wipeData(); return; }
        if (e.target.closest("#fsBtn")) {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen().catch(function () { toast("浏览器拒绝了全屏请求"); });
            return;
        }
        if (e.target.closest("#printBtn")) { window.print(); toast("正在调起打印，可存 PDF"); return; }
        if (e.target.closest("#setNameGo")) {
            store.set("skyarrow_name", $("#setName").value.trim());
            toast("昵称已保存：" + (store.get("skyarrow_name", "") || "神秘宇航员"));
            return;
        }
        if (e.target.closest("#setCdGo")) {
            var v = $("#setCdInput").value;
            if (!v) { toast("先选一个日期时间"); return; }
            CONFIG.countdownTarget = v + ":00+08:00";
            CONFIG.countdownMission = "自定义任务 · " + v.replace("T", " ");
            cdTarget = new Date(v + ":00+08:00").getTime();
            $("#cdMission").textContent = CONFIG.countdownMission;
            toast("倒计时已更新，立即生效");
            return;
        }
    });

    document.addEventListener("change", function (e) {
        if (e.target.id === "impJson") importData(e.target.files[0]);
    });

    /* 启动时应用已存设置 */
    (function applyStored() {
        var th = store.get("skyarrow_theme", "blue");
        if (th !== "blue") document.body.classList.add("theme-" + th);
        var ft = store.get("skyarrow_font", "base");
        if (ft !== "base") document.body.classList.add("font-" + ft);
        if (store.get("skyarrow_motion", "on") === "off") document.body.classList.add("no-motion");
        /* 访问计数在徽标模块自增后，此处再静默同步一次成就 */
        if (typeof refreshAch === "function") refreshAch(false);
    })();

})();
