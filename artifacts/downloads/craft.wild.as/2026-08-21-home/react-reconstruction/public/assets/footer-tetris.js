/* footer: an auto-building Tetris skyline you can take over and play across the full width, on the same canvas */
(function(){
  var cv=document.getElementById('footcity'); if(!cv) return; var ctx=cv.getContext('2d'); if(!ctx) return;
  var footer=cv.closest('footer'); if(!footer) return;
  var DPR=Math.min(devicePixelRatio||1,2), cell=9, W=0,H=0,cols=0,rows=0, on=true, phase='idle';   /* idle | flick | expand | play */
  var reduce=window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var grid=null, PAL=['#1c2541','#3b5bd9','#f5c518','#e0492a','#d8ff00'];
  function hsh(a){ var n=Math.sin(a*12.9898)*43758.5453; return n-Math.floor(n); }
  /* ---- ambient auto-build skyline ---- */
  function ci(s){ return 1+Math.min(4,(hsh(s)*5)|0); }
  function seed(){ for(var c=0;c<cols;c++){ if(hsh(c*2.3+1.1)<0.3) continue; var hh=1+Math.floor(hsh(c*4.7+0.5)*(rows*0.58)); for(var r=rows-1;r>=rows-hh && r>=0;r--) grid[r*cols+c]=ci(c*9.1+r*3.7); } }
  var APCS=[ [[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[1,1]], [[0,0],[0,1],[1,1],[2,1]], [[0,0],[1,0],[2,0],[2,1]], [[0,0],[1,0],[1,1],[2,1]] ];
  var apiece=null, at=0, afade=0, flick=0;
  function aspawn(){ if(!cols)return; var m=APCS[(Math.random()*APCS.length)|0], w=0; for(var i=0;i<m.length;i++)w=Math.max(w,m[i][0]); apiece={m:m, x:(Math.random()*(cols-w))|0, y:-2, col:1+Math.min(4,(Math.random()*5)|0)}; }
  function ahit(m,px,py){ for(var i=0;i<m.length;i++){ var gx=px+m[i][0], gy=py+m[i][1]; if(gy>=rows) return true; if(gy>=0 && (gx<0||gx>=cols||grid[gy*cols+gx])) return true; } return false; }
  function astep(){ if(afade>0)return; if(!apiece){ aspawn(); return; }
    if(ahit(apiece.m, apiece.x, apiece.y+1)){ var top=rows; for(var i=0;i<apiece.m.length;i++){ var gx=apiece.x+apiece.m[i][0], gy=apiece.y+apiece.m[i][1]; if(gy>=0&&gy<rows){ grid[gy*cols+gx]=apiece.col; if(gy<top)top=gy; } } if(top<=1) afade=0.001; apiece=null; }
    else apiece.y++; }
  function adraw(){ ctx.clearRect(0,0,W,H); var a=afade>0?Math.max(0,1-afade):1, fk=Math.floor(flick*30);
    for(var r=0;r<rows;r++)for(var c=0;c<cols;c++){ var g=grid[r*cols+c]; if(!g)continue;
      if(flick>0 && hsh(c*7.1+r*3.3+fk*2.7) < flick) continue;                 /* cells blink off as the skyline flickers out */
      ctx.globalAlpha=a; ctx.fillStyle=PAL[g-1]; ctx.fillRect(c*cell, r*cell, cell-1, cell-1); }
    if(apiece && flick<=0){ ctx.globalAlpha=1; ctx.fillStyle=PAL[apiece.col-1]; for(var i=0;i<apiece.m.length;i++){ var gx=apiece.x+apiece.m[i][0], gy=apiece.y+apiece.m[i][1]; if(gy>=0) ctx.fillRect(gx*cell, gy*cell, cell-1, cell-1); } }
    ctx.globalAlpha=1; }
  /* ---- playable, full-width: a batch of pieces falls at once and you steer them together ---- */
  var PIECES=[{c:1,m:[[1,1,1,1]]},{c:2,m:[[1,1],[1,1]]},{c:4,m:[[0,1,0],[1,1,1]]},{c:3,m:[[0,1,1],[1,1,0]]},{c:0,m:[[1,1,0],[0,1,1]]},{c:1,m:[[1,0,0],[1,1,1]]},{c:2,m:[[0,0,1],[1,1,1]]}];
  var curs=[], over=false, dropMs=300, grav=0, spawnT=0, score=0, scoreEl=null;
  function rot(m){ var R=m.length,C=m[0].length,n=[]; for(var x=0;x<C;x++){ n[x]=[]; for(var y=0;y<R;y++) n[x][y]=m[R-1-y][x]; } return n; }
  function phit(m,px,py){ for(var y=0;y<m.length;y++)for(var x=0;x<m[0].length;x++){ if(!m[y][x])continue; var gx=px+x,gy=py+y; if(gx<0||gx>=cols||gy>=rows||(gy>=0&&grid[gy*cols+gx])) return true; } return false; }
  function spawnOne(){ var cap=Math.max(2, Math.round(cols/38)); if(curs.length>=cap) return;   /* keep a few raining at once */
    var p=PIECES[(Math.random()*PIECES.length)|0], pw=p.m[0].length;
    for(var t=0;t<8;t++){ var x=(Math.random()*(cols-pw+1))|0; if(!phit(p.m,x,0)){ curs.push({m:p.m,c:p.c,x:x,y:-p.m.length}); return; } } }   /* random column, eases in from above */
  function mergeP(pc){ for(var y=0;y<pc.m.length;y++)for(var x=0;x<pc.m[0].length;x++){ if(pc.m[y][x]){ var gy=pc.y+y; if(gy>=0&&gy<rows) grid[gy*cols+pc.x+x]=pc.c+1; } } }
  function clearLines(){ var n=0; for(var y=rows-1;y>=0;y--){ var full=true; for(var x=0;x<cols;x++){ if(!grid[y*cols+x]){ full=false; break; } } if(full){ for(var yy=y;yy>0;yy--) for(var x2=0;x2<cols;x2++) grid[yy*cols+x2]=grid[(yy-1)*cols+x2]; for(var x3=0;x3<cols;x3++) grid[x3]=0; n++; y++; } }
    if(n){ score+=[0,100,300,600,1000][Math.min(4,n)]; setScore(); } }
  function pmove(d){ if(over)return; var mv=false; for(var i=0;i<curs.length;i++){ var c=curs[i]; if(!phit(c.m,c.x+d,c.y)){ c.x+=d; mv=true; } } if(mv)pdraw(); }
  function psoft(){ if(over)return; for(var i=0;i<curs.length;i++){ var c=curs[i]; if(!phit(c.m,c.x,c.y+1)) c.y++; } pdraw(); }
  function protate(){ if(over)return; for(var i=0;i<curs.length;i++){ var c=curs[i]; var r=rot(c.m),k=[0,-1,1,-2,2],j; for(j=0;j<k.length;j++){ if(!phit(r,c.x+k[j],c.y)){ c.m=r; c.x+=k[j]; break; } } } pdraw(); }
  function phard(){ if(over)return; for(var i=0;i<curs.length;i++){ var c=curs[i]; while(!phit(c.m,c.x,c.y+1)) c.y++; mergeP(c); if(c.y<=0) over=true; } curs=[]; clearLines(); pdraw(); }
  function pdraw(){ ctx.clearRect(0,0,W,H);   /* transparent: the page background grid shows behind the pieces */
    for(var r=0;r<rows;r++)for(var c=0;c<cols;c++){ var g=grid[r*cols+c]; if(g){ ctx.fillStyle=PAL[g-1]; ctx.fillRect(c*cell, r*cell, cell-1, cell-1); } }
    for(var i=0;i<curs.length;i++){ var pc=curs[i]; ctx.fillStyle=PAL[pc.c]; for(var yy=0;yy<pc.m.length;yy++)for(var xx=0;xx<pc.m[0].length;xx++){ if(pc.m[yy][xx]){ var cy=pc.y+yy; if(cy>=0) ctx.fillRect((pc.x+xx)*cell, cy*cell, cell-1, cell-1); } } }
    ov.classList.toggle('tt-isover', !!over); }
  function pstep(){ if(over)return; var still=[];
    for(var i=0;i<curs.length;i++){ var c=curs[i]; if(phit(c.m,c.x,c.y+1)){ mergeP(c); if(c.y<=0) over=true; } else { c.y++; still.push(c); } }
    curs=still;
    if(--spawnT<=0){ spawnOne(); spawnT=1+((Math.random()*4)|0); }   /* stagger spawns over random intervals */
    clearLines(); pdraw(); }
  function gtick(){ if(phase!=='play'||over) return; pstep(); grav=setTimeout(gtick,dropMs); }
  function setScore(){ if(scoreEl) scoreEl.textContent=('000000'+score).slice(-6); }
  function beginPlay(){ phase='play'; size(); for(var i=0;i<grid.length;i++) grid[i]=0; over=false; dropMs=300; score=0; setScore(); curs=[]; spawnT=0; spawnOne(); spawnOne(); pdraw(); clearTimeout(grav); grav=setTimeout(gtick,dropMs); }
  /* ---- sizing ---- */
  function size(){ var r=cv.getBoundingClientRect(); if(r.width<2)return; W=r.width;H=r.height; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); cols=Math.ceil(W/cell); rows=Math.floor(H/cell); grid=new Int8Array(cols*rows); if(phase==='idle') seed(); }
  size(); if(window.ResizeObserver) new ResizeObserver(function(){ var wasPlay=(phase==='play'); size(); if(wasPlay){ over=false; curs=[]; spawnT=0; pdraw(); } }).observe(cv);
  if('IntersectionObserver' in window){ new IntersectionObserver(function(es){ es.forEach(function(e){ on=e.isIntersecting; }); }).observe(cv); }
  /* ---- HUD overlay: score, controls, close, game over ---- */
  var ov=document.createElement('div'); ov.id='tetris';
  ov.innerHTML='<div class="tt-score">000000</div>'+
    '<div class="tt-pad">'+
      '<button data-k="left" aria-label="Move left"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></button>'+
      '<button data-k="right" aria-label="Move right"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>'+
      '<button data-k="rot" aria-label="Rotate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>'+
      '<button data-k="drop" aria-label="Hard drop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/></svg></button>'+
    '</div>'+
    '<button class="tt-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg></button>'+
    '<div class="tt-over"><span class="ttl">Game over</span><button class="tt-again" type="button">play again</button></div>';
  footer.appendChild(ov); scoreEl=ov.querySelector('.tt-score');
  if(window.__pxHover) window.__pxHover(ov.querySelector('.tt-again'));
  ov.querySelector('.tt-again').addEventListener('click', function(e){ e.stopPropagation(); beginPlay(); });
  ov.querySelector('.tt-close').addEventListener('click', function(e){ e.stopPropagation(); endGame(); });
  ov.querySelectorAll('.tt-pad button').forEach(function(b){ b.addEventListener('click', function(e){ e.stopPropagation(); if(over){ beginPlay(); return; } var a=b.getAttribute('data-k'); if(a==='left')pmove(-1); else if(a==='right')pmove(1); else if(a==='rot')protate(); else phard(); }); });
  /* ---- transitions ---- */
  function glideToFooter(){ var startY=window.pageYOffset||0, start=performance.now();   /* scroll to the very bottom so the footer ends at the bottom of the browser (nothing cut off) */
    (function tick(now){ var p=Math.min(1,(now-start)/560), e=1-Math.pow(1-p,3), maxNow=Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)-innerHeight;
      scrollTo(0, startY+(maxNow-startY)*e); if(p<1) requestAnimationFrame(tick); })(start); }
  function startGame(){ if(phase!=='idle') return; phase='flick'; flick=0.001; }
  function endGame(){ phase='idle'; footer.classList.remove('playing'); clearTimeout(grav); flick=0; over=false; curs=[]; }
  function key(e){ if(phase!=='play')return; if(e.key==='Escape'){ endGame(); return; } if(over){ if(e.key==='Enter') beginPlay(); return; }
    if(e.key==='ArrowLeft'){pmove(-1);e.preventDefault();} else if(e.key==='ArrowRight'){pmove(1);e.preventDefault();}
    else if(e.key==='ArrowDown'){psoft();e.preventDefault();} else if(e.key==='ArrowUp'||e.key==='x'||e.key==='X'){protate();e.preventDefault();}
    else if(e.key===' '){phard();e.preventDefault();} }
  document.addEventListener('keydown', key);
  footer.addEventListener('click', function(e){ if(phase!=='idle' || (e.target.closest && e.target.closest('.tt-close,.tt-pad,.tt-again'))) return; startGame(); });
  /* ---- main loop ---- */
  (function loop(){ if(on && !reduce){
      if(phase==='idle'){ at++; if(at%5===0) astep(); if(afade>0){ afade+=0.05; if(afade>=1){ grid=new Int8Array(cols*rows); seed(); afade=0; } } adraw(); }
      else if(phase==='flick'){ flick+=0.06; adraw(); if(flick>=1){ phase='expand'; footer.classList.add('playing'); glideToFooter(); setTimeout(beginPlay,580); } }
    } requestAnimationFrame(loop); })();
})();
/* teaser: cycle through tetromino pieces one at a time, like a tiny loop */
(function(){
  var cv=document.getElementById('ttpieces'); if(!cv) return; var ctx=cv.getContext('2d'); if(!ctx) return;
  var DPR=Math.min(devicePixelRatio||1,2), U=4, Wc=5*U, Hc=4*U;
  cv.width=Math.round(Wc*DPR); cv.height=Math.round(Hc*DPR); cv.style.width=Wc+'px'; cv.style.height=Hc+'px'; ctx.setTransform(DPR,0,0,DPR,0,0);
  var COL=['#3b5bd9','#f5c518','#e0492a','#d8ff00'];
  var P=[ [[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[1,1]], [[1,0],[2,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[0,1]], [[0,0],[1,0],[2,0],[2,1]] ];
  var i=0;
  function draw(){ ctx.clearRect(0,0,Wc,Hc); var m=P[i%P.length], col=COL[i%COL.length], mx=0,my=0,k; for(k=0;k<m.length;k++){ if(m[k][0]>mx)mx=m[k][0]; if(m[k][1]>my)my=m[k][1]; }
    var ox=(Wc-(mx+1)*U)/2, oy=(Hc-(my+1)*U)/2; ctx.fillStyle=col; for(k=0;k<m.length;k++) ctx.fillRect(ox+m[k][0]*U, oy+m[k][1]*U, U-1, U-1); }
  draw(); setInterval(function(){ i++; draw(); }, 520);
})();
