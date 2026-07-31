/* SVG 繪製 */
window.FP = window.FP || {};

(function (FP) {
  "use strict";

  var G = FP.geom;
  var S = FP.store.S;
  var NS = "http://www.w3.org/2000/svg";
  var svg = null;

  function el(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
      }
    }
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function init(svgNode) { svg = svgNode; }

  /* 螢幕像素 -> 世界單位的換算比例 */
  function unitsPerPixel() {
    if (!svg) return 1;
    var r = svg.getBoundingClientRect();
    return r.width > 0 ? S.view.w / r.width : 1;
  }

  /* 讓線寬與字級在任何縮放下都維持固定的視覺大小 */
  function metrics() {
    var u = unitsPerPixel();
    return {
      u: u,
      hair: u * 1,
      thin: u * 1.5,
      med: u * 2,
      label: u * 13,
      small: u * 11,
      tiny: u * 9.5,
      handle: u * 7,
      ruler: u * 22
    };
  }

  function transformOf(o) {
    return "translate(" + o.x + "," + o.y + ") rotate(" + (o.rot || 0) + "," + (o.w / 2) + "," + (o.h / 2) + ")";
  }

  function isSelected(kind, roomId, id) {
    var s = S.sel;
    if (!s || s.kind !== kind) return false;
    if (kind === "room") return s.roomId === roomId;
    if (kind === "underlay") return true;
    if (kind === "extra") return s.id === id;
    return s.roomId === roomId && s.id === id;
  }

  /* ---------- 方眼紙底 ---------- */

  function drawPaper(root, M) {
    var v = S.view;
    var defs = el("defs");

    var fine = el("pattern", { id: "grid-fine", width: 50, height: 50, patternUnits: "userSpaceOnUse" });
    fine.appendChild(el("path", {
      d: "M 50 0 L 0 0 L 0 50", fill: "none",
      stroke: "var(--grid-1)", "stroke-width": M.hair
    }));

    var bold = el("pattern", { id: "grid-bold", width: 250, height: 250, patternUnits: "userSpaceOnUse" });
    bold.appendChild(el("rect", { width: 250, height: 250, fill: "url(#grid-fine)" }));
    bold.appendChild(el("path", {
      d: "M 250 0 L 0 0 L 0 250", fill: "none",
      stroke: "var(--grid-2)", "stroke-width": M.hair * 1.4
    }));

    defs.appendChild(fine);
    defs.appendChild(bold);
    root.appendChild(defs);
    root.appendChild(el("rect", {
      x: v.x, y: v.y, width: v.w, height: v.h, fill: "url(#grid-bold)"
    }));
  }

  /* ---------- 刻度尺（本工具的識別元素） ---------- */

  function drawRulers(root, M) {
    var v = S.view;
    var T = M.ruler;

    // 依縮放決定刻度間距，避免刻度擠成一團
    var target = M.u * 8;           // 最小刻度至少 8px
    var steps = [10, 25, 50, 100, 250, 500, 1000, 2500];
    var minor = steps[steps.length - 1];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] >= target) { minor = steps[i]; break; }
    }
    var major = minor * (minor === 25 || minor === 250 || minor === 2500 ? 4 : 5);

    var g = el("g", { "pointer-events": "none", "data-layer": "ruler" });

    g.appendChild(el("rect", { x: v.x, y: v.y, width: v.w, height: T, fill: "var(--ruler-bg)" }));
    g.appendChild(el("rect", { x: v.x, y: v.y, width: T, height: v.h, fill: "var(--ruler-bg)" }));
    g.appendChild(el("line", {
      x1: v.x, y1: v.y + T, x2: v.x + v.w, y2: v.y + T,
      stroke: "var(--ruler-line)", "stroke-width": M.hair * 1.2
    }));
    g.appendChild(el("line", {
      x1: v.x + T, y1: v.y, x2: v.x + T, y2: v.y + v.h,
      stroke: "var(--ruler-line)", "stroke-width": M.hair * 1.2
    }));

    var startX = Math.floor(v.x / minor) * minor;
    for (var x = startX; x < v.x + v.w; x += minor) {
      if (x < v.x + T) continue;
      var isMajor = Math.abs(x % major) < 0.001;
      var len = isMajor ? T * 0.55 : T * 0.28;
      g.appendChild(el("line", {
        x1: x, y1: v.y + T - len, x2: x, y2: v.y + T,
        stroke: "var(--ruler-line)", "stroke-width": isMajor ? M.hair * 1.3 : M.hair
      }));
      if (isMajor) {
        g.appendChild(el("text", {
          x: x + M.u * 3, y: v.y + T * 0.42,
          "font-size": M.tiny, fill: "var(--ruler-text)",
          "font-family": "var(--font-data)", "dominant-baseline": "middle"
        }, String(Math.round(x))));
      }
    }

    var startY = Math.floor(v.y / minor) * minor;
    for (var y = startY; y < v.y + v.h; y += minor) {
      if (y < v.y + T) continue;
      var majorY = Math.abs(y % major) < 0.001;
      var lenY = majorY ? T * 0.55 : T * 0.28;
      g.appendChild(el("line", {
        x1: v.x + T - lenY, y1: y, x2: v.x + T, y2: y,
        stroke: "var(--ruler-line)", "stroke-width": majorY ? M.hair * 1.3 : M.hair
      }));
      if (majorY) {
        var tx = v.x + T * 0.42, ty = y + M.u * 3;
        g.appendChild(el("text", {
          x: tx, y: ty,
          "font-size": M.tiny, fill: "var(--ruler-text)",
          "font-family": "var(--font-data)", "text-anchor": "middle",
          transform: "rotate(-90," + tx + "," + ty + ")"
        }, String(Math.round(y))));
      }
    }

    g.appendChild(el("rect", {
      x: v.x, y: v.y, width: T, height: T,
      fill: "var(--ruler-corner)"
    }));
    g.appendChild(el("text", {
      x: v.x + T / 2, y: v.y + T / 2,
      "font-size": M.tiny, fill: "var(--ruler-text)",
      "font-family": "var(--font-data)",
      "text-anchor": "middle", "dominant-baseline": "middle"
    }, "cm"));

    root.appendChild(g);
  }

  /* ---------- 底圖 ---------- */

  function drawUnderlay(root, M) {
    var u = S.doc.underlay;
    if (!u || !S.showUnderlay) return;
    var on = isSelected("underlay");
    var g = el("g", { "data-underlay": "1", transform: transformOf(u), style: "cursor:move" });
    g.appendChild(el("image", {
      x: 0, y: 0, width: u.w, height: u.h,
      href: u.src, opacity: u.opacity, preserveAspectRatio: "none"
    }));
    g.appendChild(el("rect", {
      x: 0, y: 0, width: u.w, height: u.h, fill: "none",
      stroke: on ? "var(--accent)" : "var(--graphite)",
      "stroke-width": on ? M.med : M.hair,
      "stroke-dasharray": (M.u * 10) + " " + (M.u * 7)
    }));
    if (on) {
      g.appendChild(el("circle", {
        cx: u.w, cy: u.h, r: M.handle, fill: "var(--paper)",
        stroke: "var(--accent)", "stroke-width": M.med,
        "data-underlay-handle": "1", style: "cursor:nwse-resize"
      }));
    }
    root.appendChild(g);
  }

  /* ---------- 額外區域與文字 ---------- */

  function drawExtras(root, M) {
    S.doc.extras.forEach(function (ex) {
      var on = isSelected("extra", null, ex.id);
      var g = el("g", { "data-extra": ex.id, style: "cursor:move" });

      if (ex.kind === "area") {
        g.setAttribute("transform", transformOf(ex));
        g.appendChild(el("rect", {
          x: 0, y: 0, width: ex.w, height: ex.h, rx: M.u * 4,
          fill: "var(--area)", "fill-opacity": 0.10,
          stroke: on ? "var(--accent)" : "var(--area)",
          "stroke-width": on ? M.med : M.thin,
          "stroke-dasharray": (M.u * 9) + " " + (M.u * 6)
        }));
        var tg = el("g", {
          transform: "rotate(" + (-(ex.rot || 0)) + "," + (ex.w / 2) + "," + (ex.h / 2) + ")",
          "pointer-events": "none"
        });
        tg.appendChild(el("text", {
          x: ex.w / 2, y: ex.h / 2 - M.small * 0.4,
          "text-anchor": "middle", "dominant-baseline": "middle",
          "font-size": M.small, fill: "var(--area-ink)"
        }, ex.text));
        tg.appendChild(el("text", {
          x: ex.w / 2, y: ex.h / 2 + M.small * 0.9,
          "text-anchor": "middle", "dominant-baseline": "middle",
          "font-size": M.tiny, fill: "var(--graphite)",
          "font-family": "var(--font-data)"
        }, Math.round(ex.w) + "×" + Math.round(ex.h)));
        g.appendChild(tg);

        if (on) {
          g.appendChild(el("circle", {
            cx: ex.w, cy: ex.h, r: M.handle, fill: "var(--paper)",
            stroke: "var(--accent)", "stroke-width": M.med,
            "data-extra-handle": ex.id, style: "cursor:nwse-resize"
          }));
          addRotateHandle(g, ex, M);
        }
      } else {
        g.appendChild(el("circle", {
          cx: ex.x, cy: ex.y, r: M.u * 3,
          fill: on ? "var(--accent)" : "var(--graphite)"
        }));
        g.appendChild(el("text", {
          x: ex.x + M.u * 8, y: ex.y,
          "font-size": M.label, "font-weight": 600,
          "dominant-baseline": "middle",
          fill: on ? "var(--accent)" : "var(--ink)"
        }, ex.text));
      }
      root.appendChild(g);
    });
  }

  /* ---------- 房間 ---------- */

  function drawRooms(root, M) {
    var W = S.doc.wallThickness;

    S.doc.rooms.forEach(function (r) {
      var on = isSelected("room", r.id);
      var g = el("g", { "data-room": r.id, transform: transformOf(r), style: "cursor:move" });

      g.appendChild(el("rect", {
        x: 0, y: 0, width: r.w, height: r.h,
        fill: r.fill, stroke: "var(--ink)",
        "stroke-width": Math.max(W, M.thin), "stroke-linejoin": "miter"
      }));

      if (on) {
        var pad = Math.max(W, M.thin) / 2 + M.u * 3;
        g.appendChild(el("rect", {
          x: -pad, y: -pad, width: r.w + pad * 2, height: r.h + pad * 2,
          fill: "none", stroke: "var(--accent)",
          "stroke-width": M.thin, "stroke-linejoin": "miter"
        }));
      }

      // 房名與尺寸：反轉房間旋轉，保持正向可讀
      var lg = el("g", {
        transform: "rotate(" + (-(r.rot || 0)) + "," + (r.w / 2) + "," + (r.h / 2) + ")",
        "pointer-events": "none"
      });
      lg.appendChild(el("text", {
        x: r.w / 2, y: r.h / 2 - M.label * 0.42,
        "text-anchor": "middle", "dominant-baseline": "middle",
        "font-size": M.label, "font-weight": 600, fill: "var(--ink)"
      }, r.name));
      var dim = r.w + " × " + r.h + (r.rot ? "   " + Math.round(r.rot) + "°" : "");
      lg.appendChild(el("text", {
        x: r.w / 2, y: r.h / 2 + M.label * 0.75,
        "text-anchor": "middle", "dominant-baseline": "middle",
        "font-size": M.small, fill: "var(--graphite)",
        "font-family": "var(--font-data)"
      }, dim));
      g.appendChild(lg);

      r.openings.forEach(function (op) { drawOpening(g, r, op, M, W); });

      if (on) addRotateHandle(g, r, M);
      root.appendChild(g);
    });
  }

  function drawOpening(parent, room, op, M, W) {
    var L = G.openingLocal(room, op);
    var on = isSelected("opening", room.id, op.id);
    var base = op.type === "window" ? "var(--window)" : "var(--door)";
    var col = on ? "var(--accent)" : base;
    var wallW = Math.max(W, M.thin);

    var g = el("g", { "data-opening": op.id, "data-opening-room": room.id, style: "cursor:grab" });

    // 先把牆體挖空
    g.appendChild(el("line", {
      x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2,
      stroke: "var(--paper)", "stroke-width": wallW + M.hair * 2,
      "stroke-linecap": "butt"
    }));

    var px = L.nx * wallW / 2, py = L.ny * wallW / 2;

    if (op.type === "window") {
      [-1, 1].forEach(function (s) {
        g.appendChild(el("line", {
          x1: L.x1 + px * s, y1: L.y1 + py * s,
          x2: L.x2 + px * s, y2: L.y2 + py * s,
          stroke: col, "stroke-width": M.thin, "stroke-linecap": "butt"
        }));
      });
      g.appendChild(el("line", {
        x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2,
        stroke: col, "stroke-width": M.thin * 1.3, "stroke-linecap": "butt"
      }));
    } else if (op.note === "開口（無門）") {
      [[L.x1, L.y1], [L.x2, L.y2]].forEach(function (q) {
        g.appendChild(el("line", {
          x1: q[0] - px, y1: q[1] - py, x2: q[0] + px, y2: q[1] + py,
          stroke: col, "stroke-width": M.med
        }));
      });
    } else {
      var d = G.doorSwing(room, op);
      g.appendChild(el("line", {
        x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2,
        stroke: col, "stroke-width": M.thin, "stroke-linecap": "butt",
        "stroke-dasharray": (M.u * 5) + " " + (M.u * 3.5)
      }));
      g.appendChild(el("line", {
        x1: d.hx, y1: d.hy, x2: d.ox, y2: d.oy,
        stroke: col, "stroke-width": M.thin, opacity: 0.7
      }));
      g.appendChild(el("path", {
        d: d.arc, fill: "none", stroke: col,
        "stroke-width": M.hair * 1.6, opacity: 0.55
      }));
    }

    // 尺寸標註，同樣保持正向
    var mx = (L.x1 + L.x2) / 2 - L.nx * (wallW / 2 + M.small * 1.0);
    var my = (L.y1 + L.y2) / 2 - L.ny * (wallW / 2 + M.small * 1.0);
    var mg = el("g", {
      transform: "rotate(" + (-(room.rot || 0)) + "," + mx + "," + my + ")",
      "pointer-events": "none"
    });
    mg.appendChild(el("text", {
      x: mx, y: my, "text-anchor": "middle", "dominant-baseline": "middle",
      "font-size": M.small, fill: col, "font-weight": 600,
      "font-family": "var(--font-data)"
    }, String(Math.round(op.length))));
    g.appendChild(mg);

    g.appendChild(el("circle", {
      cx: L.x1, cy: L.y1, r: M.handle * 0.8, fill: "var(--paper)",
      stroke: col, "stroke-width": M.thin, "data-grip": "a"
    }));
    g.appendChild(el("circle", {
      cx: L.x2, cy: L.y2, r: M.handle * 0.8, fill: "var(--paper)",
      stroke: col, "stroke-width": M.thin, "data-grip": "b"
    }));

    parent.appendChild(g);
  }

  function addRotateHandle(parent, obj, M) {
    var off = M.handle * 3.6;
    parent.appendChild(el("line", {
      x1: obj.w / 2, y1: 0, x2: obj.w / 2, y2: -off,
      stroke: "var(--accent)", "stroke-width": M.thin, "pointer-events": "none"
    }));
    parent.appendChild(el("circle", {
      cx: obj.w / 2, cy: -off, r: M.handle * 1.2,
      fill: "var(--paper)", stroke: "var(--accent)", "stroke-width": M.med,
      "data-rotate": obj.id, style: "cursor:grab"
    }));
    var ig = el("g", {
      transform: "rotate(" + (-(obj.rot || 0)) + "," + (obj.w / 2) + "," + (-off) + ")",
      "pointer-events": "none"
    });
    ig.appendChild(el("text", {
      x: obj.w / 2, y: -off, "text-anchor": "middle", "dominant-baseline": "middle",
      "font-size": M.handle * 1.4, fill: "var(--accent)", "font-weight": 700
    }, "\u21BB"));
    parent.appendChild(ig);
  }

  /* ---------- 指北針 ---------- */

  function drawCompass(root, M) {
    var v = S.view;
    var R = v.w * 0.042;
    var cx = v.x + v.w - R * 2.2;
    var cy = v.y + R * 2.2 + M.ruler;
    var a = FP.schema.norm360(360 - S.doc.upBearing) * Math.PI / 180;
    var nx = Math.sin(a), ny = -Math.cos(a);

    var g = el("g", { "pointer-events": "none" });
    g.appendChild(el("circle", {
      cx: cx, cy: cy, r: R, fill: "var(--paper)", "fill-opacity": 0.9,
      stroke: "var(--rule)", "stroke-width": M.hair * 1.4
    }));
    g.appendChild(el("line", {
      x1: cx - nx * R * 0.72, y1: cy - ny * R * 0.72,
      x2: cx + nx * R * 0.72, y2: cy + ny * R * 0.72,
      stroke: "var(--graphite)", "stroke-width": M.hair * 1.4
    }));
    var tipX = cx + nx * R * 0.76, tipY = cy + ny * R * 0.76;
    var pxv = -ny, pyv = nx;
    g.appendChild(el("path", {
      d: "M " + tipX + " " + tipY +
         " L " + (cx + nx * R * 0.3 + pxv * R * 0.2) + " " + (cy + ny * R * 0.3 + pyv * R * 0.2) +
         " L " + (cx + nx * R * 0.3 - pxv * R * 0.2) + " " + (cy + ny * R * 0.3 - pyv * R * 0.2) + " Z",
      fill: "var(--accent)"
    }));
    g.appendChild(el("text", {
      x: cx + nx * R * 1.32, y: cy + ny * R * 1.32,
      "text-anchor": "middle", "dominant-baseline": "middle",
      "font-size": M.small, "font-weight": 700, fill: "var(--accent)"
    }, "北"));
    root.appendChild(g);
  }

  /* ---------- 主流程 ---------- */

  function render() {
    if (!svg) return;
    var v = S.view;
    var M = metrics();
    svg.setAttribute("viewBox", v.x + " " + v.y + " " + v.w + " " + v.h);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    drawPaper(svg, M);
    drawUnderlay(svg, M);
    drawExtras(svg, M);
    drawRooms(svg, M);
    drawCompass(svg, M);
    drawRulers(svg, M);
  }

  /* 匯出用：把 CSS 變數換成實際色值 */
  function toStandaloneSVG(width, height) {
    var clone = svg.cloneNode(true);
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);
    clone.setAttribute("xmlns", NS);
    var cs = getComputedStyle(document.documentElement);
    var markup = new XMLSerializer().serializeToString(clone);
    var vars = markup.match(/var\(--[a-z0-9-]+\)/g) || [];
    var seen = {};
    vars.forEach(function (token) {
      if (seen[token]) return;
      seen[token] = true;
      var name = token.slice(4, -1);
      var value = (cs.getPropertyValue(name) || "").trim() || "#333333";
      // 屬性值本身用雙引號包住，字型堆疊裡的雙引號要換掉才不會截斷屬性
      value = value.replace(/"/g, "'");
      markup = markup.split(token).join(value);
    });
    return markup;
  }

  FP.render = {
    init: init,
    render: render,
    metrics: metrics,
    unitsPerPixel: unitsPerPixel,
    toStandaloneSVG: toStandaloneSVG,
    el: el
  };
})(window.FP);
