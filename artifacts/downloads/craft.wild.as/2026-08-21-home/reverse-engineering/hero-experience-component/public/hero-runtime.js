/* Generated from the downloaded public page runtime. */

/* ===== hero keyvisual: clouds field + neon + decode-to-real-text + detonate; clips into rounded box on scroll ===== */
(function(){
  var cv=document.getElementById('hero-kv'), hero=document.getElementById('hero'), origin=document.querySelector('.intro')||document.getElementById('origin'); if(!cv) return; var ctx=cv.getContext('2d'); if(!ctx) return;
  var DPR=Math.min(devicePixelRatio||1,2), W=0,H=0, cell=9, BRUSH=10, cols=0, rows=0, heat=null, dis=null, t=0, SEED=Math.random()*1000;
  var waves=[], shake=0, mx=-1,my=-1,hov=false, typeT=0, introT=0, RSPREAD=1.15, RLEAD=0.16, TBLOCK=6, tcols=0, trows=0;
  var LINES=['CRAFT,','ENGINEERED.'];
  var BANDS=[[0.30,'#1c2541'],[0.46,'#3b5bd9'],[0.62,'#f5c518'],[0.78,'#e0492a']];
  var tmask=document.createElement('canvas'), tmc=tmask.getContext('2d'), tfx=document.createElement('canvas'), tfc=tfx.getContext('2d');
  var smask=document.createElement('canvas'), smc=smask.getContext('2d'), sData=null, TB=null;
  function size(){ W=innerWidth; H=innerHeight; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0);
    tmask.width=cv.width; tmask.height=cv.height; tmc.setTransform(DPR,0,0,DPR,0,0); tfx.width=cv.width; tfx.height=cv.height; tfc.setTransform(DPR,0,0,DPR,0,0);
    cols=Math.ceil(W/cell)+1; rows=Math.ceil(H/cell)+1; heat=new Float32Array(cols*rows); dis=new Float32Array(cols*rows); smask.width=cols; smask.height=rows; }
  var lastW=innerWidth; size(); addEventListener('resize',function(){ if(innerWidth!==lastW){ lastW=innerWidth; size(); } });   /* ignore iOS address-bar height toggles that reset the field */
  var hrTop=0, hrH=0, fhb=-1;                  /* hero rect (viewport): headline & safe zones follow it; fhb = eased fade edge */
  /* every copy block & image keeps the pixels out of it; the field only fills the gaps */
  var pxsafeEls=[].slice.call(document.querySelectorAll('.masthead .mh-l, .masthead .mh-r, .masthead .mh-c'));
  function hsh(c,r){ var n=Math.sin(c*127.1+r*311.7+SEED*0.13)*43758.5453; return n-Math.floor(n); }
  function base(nx,ny,tt){ var s=SEED; nx+=Math.sin(ny*5+tt*0.5+s)*0.05; ny+=Math.cos(nx*5-tt*0.4)*0.05;
    var v=Math.sin(nx*5.6+s*1.3+tt*0.3)*Math.cos(ny*4.7-s*0.7+tt*0.22)+Math.sin((nx*1.4+ny*1.7)*4.1-s+tt*0.16)+Math.sin(ny*9+s*2.1+nx*3)*0.5+Math.sin(nx*13-s*1.7)*0.28;
    return 0.5+0.5*(v/2.55); }
  /* low-frequency blobs: deeper in the page the field only survives inside these, so pixels cluster in areas (no scattered singles) */
  function region(nx,ny,tt){ return 0.5+0.5*Math.sin(nx*2.1+tt*0.12+SEED*0.7)*Math.cos(ny*1.8-tt*0.09+SEED*0.3); }
  function dep(x,y,amt,sig){ var cc=x/cell,cr=y/cell,rad=Math.ceil(sig*1.6),inv=1/(2*sig*sig*0.18);
    for(var dr=-rad;dr<=rad;dr++)for(var dc=-rad;dc<=rad;dc++){ var c=(cc+dc)|0,r=(cr+dr)|0; if(c<0||r<0||c>=cols||r>=rows)continue;
      var dx=c+.5-cc,dy=r+.5-cr,w=Math.exp(-(dx*dx+dy*dy)*inv); if(w<.02)continue; var id=r*cols+c,vv=heat[id]+amt*w; heat[id]=vv>1?1:vv; } }
  /* stamp the blob along the cursor's path so a fast flick stays continuous instead of vanishing between frames */
  var pmx=-1, pmy=-1, lastMove=-9, vel=0, lastZone2='', hopT=-9;
  function follow(x,y,sig){ if(pmx<0){pmx=x;pmy=y;}
    var dx=x-pmx, dy=y-pmy, dl=Math.sqrt(dx*dx+dy*dy), steps=Math.max(1,Math.min(48,Math.round(dl/(cell*0.8))));
    for(var s=1;s<=steps;s++){ var f=s/steps; dep(pmx+dx*f, pmy+dy*f, 0.16, sig); }
    pmx=x; pmy=y; }
  var ZG=[[0,0],[1,0],[2,0],[1,0.55],[0,1.1],[1,1.1],[2,1.1]];
  /* a filled disk with a chomping wedge carved out: Pac-Man, facing `ang` */
  function pacman(cx,cy,rad,ang,mouth,val){ var c0=Math.floor((cx-rad)/cell),c1=Math.ceil((cx+rad)/cell),r0=Math.floor((cy-rad)/cell),r1=Math.ceil((cy+rad)/cell),rr=rad*rad;
    for(var r=r0;r<=r1;r++)for(var c=c0;c<=c1;c++){ if(c<0||r<0||c>=cols||r>=rows)continue; var dx=(c+.5)*cell-cx, dy=(r+.5)*cell-cy; if(dx*dx+dy*dy>rr)continue;
      var da=Math.abs((((Math.atan2(dy,dx)-ang)%(2*Math.PI))+3*Math.PI)%(2*Math.PI)-Math.PI); if(da<mouth)continue;   /* carve the mouth wedge in the facing direction */
      var id=r*cols+c, v=val+0.03*Math.sin((c*0.7+r*0.7)-t*0.01); if(v>heat[id])heat[id]=v; } }
  /* inactive: the blob becomes a Pac-Man, heads off in a straight line eating a row of pellets, until it leaves the screen */
  var pacOn=false, pacx=0, pacy=0, pacDir=1, pacStart=0, pacAge=0, PFOOD=34;
  function wander(restx,resty,tt){
    if(!pacOn){ pacOn=true; pacDir=(restx<W*0.5)?1:-1; pacx=restx; pacy=resty; pacStart=restx; pacAge=0; PFOOD=BRUSH*3.4; }
    var rad=BRUSH*3.4;                                                       /* big enough to read clearly as Pac-Man */
    pacAge++; pacx += pacDir*2.6;                                            /* straight horizontal line, steady speed */
    if(pacx > W+rad+12 || pacx < -rad-12){                                   /* left the screen -> respawn on a fresh row, crossing back */
      pacDir = Math.random()<0.5?1:-1; pacy = 70 + Math.random()*(H-140); pacx = pacDir>0 ? -rad : W+rad; pacStart=pacx; pacAge=0; }
    var ang=pacDir>0?0:Math.PI;
    var pr=Math.round(pacy/cell);                                            /* pellets sit on one grid row */
    for(var k=1;k<=80;k++){ var px=pacStart + pacDir*PFOOD*k; if(px<-20||px>W+20)continue;
      if(pacDir*(px-pacx) > rad*0.7){ var pc=Math.round(px/cell); if(pc>=0&&pr>=0&&pc<cols&&pr<rows){ var pid=pr*cols+pc; if(0.72>heat[pid])heat[pid]=0.72; } } }   /* 1-cell pellets ahead of him; each vanishes as the mouth reaches it */
    var mouth=0.05+0.6*Math.abs(Math.sin(pacAge*0.16));                     /* chomp open/close */
    pacman(pacx, pacy, rad, ang, mouth, 0.72);                              /* 0.72 => yellow band */
  }
  /* hovered slide: a single one-cell-thick line of hero-coloured pixels around its image */
  var hoverSlide=null;
  function setEdge(c,r){ if(c<0||r<0||c>=cols||r>=rows)return; var id=r*cols+c;
    var w=0.5+0.5*Math.sin((c*0.8+r*0.8) - t*0.006);          /* a colour wave travels around the line */
    heat[id]=0.34 + w*0.56 + (hsh(c,r)-0.5)*0.12; }
  function measureType(){ var fs=Math.min((W*0.6)/2.6, H*0.165), lh=fs*0.92, cy=hrTop + hrH*0.45;
    tmc.font='400 '+fs+'px Sneak,sans-serif'; var mw=1; for(var i=0;i<LINES.length;i++){ var ww=tmc.measureText(LINES[i]).width; if(ww>mw)mw=ww; }
    TB={cx:W/2, w:mw, fs:fs, lh:lh, y0:cy-lh/2};
    tmc.clearRect(0,0,W,H); tmc.textAlign='center'; tmc.textBaseline='middle'; tmc.fillStyle='#000'; for(i=0;i<LINES.length;i++) tmc.fillText(LINES[i], W/2, TB.y0+i*lh);
    /* safe zone: clear the field behind the title so it stays readable */
    smc.setTransform(1,0,0,1,0,0); smc.clearRect(0,0,cols,rows); smc.textAlign='center'; smc.textBaseline='middle'; smc.lineJoin='round'; smc.lineWidth=3.2; smc.strokeStyle='#000'; smc.fillStyle='#000';
    for(i=0;i<LINES.length;i++){ smc.font='400 '+(fs/cell)+'px Sneak,sans-serif'; smc.strokeText(LINES[i], (W/2)/cell, (TB.y0+i*lh)/cell); smc.fillText(LINES[i], (W/2)/cell, (TB.y0+i*lh)/cell); }
    sData=smc.getImageData(0,0,cols,rows).data; }
  function clamp01(x){ return x<0?0:(x>1?1:x); }
  function clearAt(c,r,x,y){
    if(sData && sData[(r*cols+c)*4+3]>40) return 1;            /* headline: keep clean & readable */
    var yr=y-hrTop;                                             /* relative to the hero (it scrolls) */
    var tl=clamp01((400-x)/150)*clamp01((220-yr)/130);
    var tr=clamp01((x-(W-360))/150)*clamp01((220-yr)/130);
    var bl=clamp01((W*0.52-x)/170)*clamp01((yr-(hrH-210))/130);
    return Math.max(tl,tr,bl); }                                /* corner safe zones: soft, fuzzy edges */
  function drawTypeReveal(g2,color){ if(!TB)return; var n=Math.ceil(W/TBLOCK), span=Math.max(1,n), tick=Math.floor(typeT*16), nr=Math.ceil(H/TBLOCK);
    tfc.clearRect(0,0,W,H); tfc.fillStyle=color;
    for(var c=0;c<n;c++){ var key=c/span, ra=key*RSPREAD;
      if(typeT>=ra){ tfc.fillRect(c*TBLOCK,0,TBLOCK,H); }
      else if(typeT>ra-RLEAD){ var prob=0.25+0.75*(1-(ra-typeT)/RLEAD); for(var r=0;r<nr;r++){ if(hsh(c+tick*0.7,r)<prob) tfc.fillRect(c*TBLOCK,r*TBLOCK,TBLOCK,TBLOCK); } } }
    tfc.globalCompositeOperation='destination-in'; tfc.drawImage(tmask,0,0,W,H); tfc.globalCompositeOperation='source-over'; g2.drawImage(tfx,0,0,W,H); }
  var TOUCH = !(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);   /* phones/tablets: no mouse */
  var secOrigin=document.getElementById('origin'), secAi=document.getElementById('ai'), secContact=document.getElementById('contact'), footEl=document.querySelector('footer');
  var secProcess=document.getElementById('process'), secProto=document.getElementById('protocol'), secProtoParts=document.getElementById('protocol-parts');
  function spans(el,y){ if(!el)return false; var r=el.getBoundingClientRect(); return r.top<y && r.bottom>y; }
  /* which section is under the cursor -> the CTA marquee/follow, or the heart over the origin story */
  function zoneOf(el){ if(!el||!el.closest) return '';
    return el.closest('#contact, footer') ? 'text'
      : el.closest('#origin') ? 'heart' : ''; }
  var hoverEls=[], groups=[], smileyEls=[], ctaMeta=null, headEls=[], headElsM=[];
  function collectTargets(){
    hoverEls=[].slice.call(document.querySelectorAll(TOUCH ? '.btn' : '.slide:first-child .csm, .slide:first-child .pv, .btn'));
    headEls=[].slice.call(document.querySelectorAll('.hero h1, .ed h2, .proc h2, .ch h2'));   /* desktop: the blob points at every headline */
    headElsM=[].slice.call(document.querySelectorAll('[data-blobarrow]'));                     /* mobile: only these couple get the auto-blob arrow */
    groups=[];
    ['#process .donuts','#protocol-parts .donuts'].forEach(function(sel){ var h=document.querySelector(sel); if(h){ var e=[].slice.call(h.querySelectorAll('.donut')); if(e.length) groups.push({host:h,els:e,frame:true}); } });
    var two=document.querySelector('#shift .two'); if(two){ var sm=[].slice.call(two.querySelectorAll('.smiley')); if(sm.length) groups.push({host:two,els:sm,frame:false}); }
    /* smileys the cursor blob can be pulled into; heat value picks the band colour (neon vs blue) */
    smileyEls=[].slice.call(document.querySelectorAll('#shift .smiley')).map(function(el){ return {el:el, val: el.getAttribute('data-base')==='#3b5bd9' ? 0.56 : 1.0}; });
    ctaMeta=document.querySelector('#contact .meta');
  }
  collectTargets(); addEventListener('load',collectTargets);
  function nearestTarget(vc){ var best=null,bd=H*0.42,i,r,d; for(i=0;i<hoverEls.length;i++){ r=hoverEls[i].getBoundingClientRect(); if(r.width<2||r.bottom<0||r.top>H)continue; d=Math.abs(r.top+r.height/2-vc); if(d<bd){bd=d;best=hoverEls[i];} } return best; }
  /* nearest headline within a margin of the cursor -> the blob points at it / reacts */
  function nearHeadline(x,y,list){ var best=null,bd=1e9,i,r,M=150; for(i=0;i<list.length;i++){ r=list[i].getBoundingClientRect(); if(r.width<2||r.bottom<-40||r.top>H+40)continue;
      if(x<r.left-M||x>r.right+M||y<r.top-M||y>r.bottom+M)continue;            /* cursor must be within the margin band */
      var cx=r.left+r.width/2, cy=r.top+r.height/2, d=Math.hypot(x-cx,y-cy); if(d<bd){ bd=d; best={x:cx,y:cy,idx:i}; } } return best; }
  function ctr(el){ var r=el.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; }
  function activeGroup(vc){ var best=null,bd=H*0.55,i,h,d;
    for(i=0;i<groups.length;i++){ h=groups[i].host.getBoundingClientRect(); if(h.bottom<0||h.top>H||h.height<2)continue; d=Math.abs(h.top+h.height/2-vc); if(d<bd){bd=d;best=groups[i];} }
    if(!best) return null;
    var hb2=best.host.getBoundingClientRect(), n=best.els.length, p=(vc-hb2.top)/Math.max(1,hb2.height); p=Math.max(0,Math.min(0.9999,p));
    if(n<2){ var c=ctr(best.els[0]); return {x:c[0],y:c[1],el:best.els[0],frame:best.frame}; }
    var f=p*(n-1), i0=Math.floor(f), fr=f-i0, a=ctr(best.els[i0]), b=ctr(best.els[Math.min(n-1,i0+1)]);
    return {x:a[0]*(1-fr)+b[0]*fr, y:a[1]*(1-fr)+b[1]*fr, el:best.els[fr<0.5?i0:Math.min(n-1,i0+1)], frame:best.frame};
  }
  addEventListener('pointermove',function(e){ if(TOUCH) return; lastMove=performance.now()/1000; pacOn=false; mx=e.clientX; my=e.clientY; hov=true; cursorZone=zoneOf(e.target); });           /* heat follows the cursor anywhere on the page */
  addEventListener('scroll',function(){ if(TOUCH||!hov||mx<0)return; lastMove=performance.now()/1000; pacOn=false; cursorZone=zoneOf(document.elementFromPoint(mx,my)); }, {passive:true});   /* scrolling counts as activity (resets the Pac-Man timer) and re-checks the section under the cursor */
  document.querySelectorAll('.slide .csm, .slide .pv, .ctabtn, .btn, .proc .donut').forEach(function(m){
    m.addEventListener('mouseenter',function(){ hoverSlide=m; });
    m.addEventListener('mouseleave',function(){ if(hoverSlide===m) hoverSlide=null; }); });
  var charging=false, chT0=0, chx=0, chy=0;
  addEventListener('pointerdown',function(e){ if(TOUCH) return; if(e.target.closest('a,button,input,.masthead,.pxctl')) return;
    charging=true; chT0=performance.now()/1000; chx=e.clientX; chy=e.clientY; });                                /* hold to charge (pointer devices only) */
  function release(){ if(!charging) return; charging=false; var ns=performance.now()/1000, ch=Math.min((ns-chT0)/2.2,1);
    waves.push({x:chx,y:chy,t0:ns,pow:0.35+ch*2.1}); dep(chx,chy,1,BRUSH*(2.5+ch*18)); shake=0.45+ch*1.9;          /* slower ramp (2.2s to full); a quick tap is gentle, a long hold blows up */
    var hb=hero.getBoundingClientRect(); if(hb.bottom>0 && hb.top<H) typeT=0; }
  addEventListener('pointerup',release); addEventListener('pointercancel',release);
  var cursorZone='';
  var HEART=[[2,1],[3,1],[5,1],[6,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[2,4],[3,4],[4,4],[5,4],[6,4],[3,5],[4,5],[5,5],[4,6]];
  /* the heart, drawn 2x bigger over the origin story */
  function stampHeart(cx,cy){ var S=2, bc=Math.round(cx/cell), br=Math.round(cy/cell), o=4*S;
    for(var k=0;k<HEART.length;k++){ for(var yy=0;yy<S;yy++)for(var xx=0;xx<S;xx++){ var C=bc+HEART[k][0]*S+xx-o, R=br+HEART[k][1]*S+yy-o; if(C<0||R<0||C>=cols||R>=rows)continue; var id=R*cols+C, w=0.86+0.12*Math.sin((C*0.6+R*0.6)-t*0.006); if(w>heat[id])heat[id]=w; } } }
  /* a small explosion of heart-coloured sparks when the heart first appears */
  var hsparks=[];
  function heartBoom(x,y){ for(var i=0;i<16;i++){ var a=i/16*6.2832, sp=BRUSH*(0.7+hsh(i,x)*0.7); hsparks.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1}); } }
  var wasHeart=false;
  var SAYS=['nice','wow','ooh','yes','neat','huh','oh!'];   /* the blob's little reactions to headlines */
  /* a big crisp arrow that rotates to any angle to point at the headline, with a highlight pulse running toward the tip */
  function pointArrow(x,y,ang,tt){ var L=BRUSH*8.5, ca=Math.cos(ang), sa=Math.sin(ang), tipx=x+ca*L, tipy=y+sa*L;
    var pulse=(tt*0.9)%1, steps=Math.max(16,Math.round(L/(cell*0.5)));
    for(var i=0;i<=steps;i++){ var f=i/steps, hi=Math.exp(-Math.pow((f-pulse)*3.0,2)); dep(x+ca*L*f, y+sa*L*f, 0.5+0.46*hi, 0.95); }   /* thin shaft (sig~1 cell) + travelling bright band toward the tip */
    var hl=BRUSH*3.4; for(var s=-1;s<=1;s+=2){ var ba=ang+Math.PI+s*0.62, bsteps=Math.max(8,Math.round(hl/(cell*0.5)));
      for(var j=0;j<=bsteps;j++){ var g=j/bsteps; dep(tipx+Math.cos(ba)*hl*g, tipy+Math.sin(ba)*hl*g, 0.72, 0.95); } } }   /* crisp arrowhead barbs */
  function stampCells(cx,cy,cells,ox,oy){ var bc=Math.round(cx/cell), br=Math.round(cy/cell); for(var k=0;k<cells.length;k++){ var C=bc+cells[k][0]-ox, R=br+cells[k][1]-oy; if(C<0||R<0||C>=cols||R>=rows)continue; var id=R*cols+C, w=0.8+0.16*Math.sin((C*0.7+R*0.7)-t*0.005); if(w>heat[id])heat[id]=w; } }
  /* fill a circle of heat at a fixed value (the blob taking the shape + colour of a smiley face) */
  function stampDisk(cx,cy,rad,val){ if(rad<3)return; var c0=Math.floor((cx-rad)/cell),c1=Math.ceil((cx+rad)/cell),r0=Math.floor((cy-rad)/cell),r1=Math.ceil((cy+rad)/cell), rr=rad*rad, fk=Math.floor(t/140), ACCV=[0.96,0.72,0.82];
    for(var r=r0;r<=r1;r++)for(var c=c0;c<=c1;c++){ if(c<0||r<0||c>=cols||r>=rows)continue; var dx=(c+.5)*cell-cx, dy=(r+.5)*cell-cy; if(dx*dx+dy*dy>rr)continue;
      var v = hsh(c*1.7+0.3, r*1.1+fk*3.7) < 0.18 ? ACCV[(hsh(c+fk*2.1, r-fk*1.3)*3)|0] : val+0.03*Math.sin((c*0.7+r*0.7)-t*0.01);   /* base colour, ~18% of cells flicker to accents, retimed to ~7fps */
      heat[r*cols+c]=v; } }
  var txtC=document.createElement('canvas'), txc=txtC.getContext('2d'), TXT='the answer is yes we do it     ', txtW=0, TXH=20, txtData=null, txtScroll=0;
  function buildTxt(){ txc.font='18px "Sneak",monospace'; txtW=Math.max(8,Math.ceil(txc.measureText(TXT).width)); txtC.width=txtW; txtC.height=TXH; txc.font='18px "Sneak",monospace'; txc.textBaseline='middle'; txc.fillStyle='#000'; txc.clearRect(0,0,txtW,TXH); txc.fillText(TXT,0,TXH/2); txtData=txc.getImageData(0,0,txtW,TXH).data; }
  function stampText(cx,cy){ if(!txtData) buildTxt(); var br=Math.round(cy/cell)-(TXH>>1), so=Math.floor(txtScroll), amp=TOUCH?0.05:0.14;   /* gentler shimmer on touch so the marquee stays in one colour band instead of flickering across them */
    for(var lc=0;lc<cols;lc++){ var mc=(((so+lc)%txtW)+txtW)%txtW; for(var lr=0;lr<TXH;lr++){ if(txtData[(lr*txtW+mc)*4+3]>80){ var R=br+lr; if(R<0||R>=rows)continue; var id=R*cols+lc, ww=0.84+amp*Math.sin((lc*0.6+lr*0.6)-t*0.006); if(ww>heat[id])heat[id]=ww; } } } }
  /* blob "speech": a short word stamped above it in chunky pixels (reacting to a headline) */
  var sayC=document.createElement('canvas'), sayx=sayC.getContext('2d'), sayMasks={};
  function saymask(txt){ if(sayMasks[txt])return sayMasks[txt]; sayx.font='bold 12px "Sneak",monospace'; var w=Math.max(8,Math.ceil(sayx.measureText(txt).width)),h=12; sayC.width=w; sayC.height=h;
    sayx.font='bold 12px "Sneak",monospace'; sayx.textBaseline='middle'; sayx.fillStyle='#000'; sayx.clearRect(0,0,w,h); sayx.fillText(txt,0,h/2); var o={d:sayx.getImageData(0,0,w,h).data,w:w,h:h}; sayMasks[txt]=o; return o; }
  function sayWord(txt,x,y,pop){ var o=saymask(txt), th=38, sc=th/o.h, tw=o.w*sc, ox=x-tw/2, oy=y-28-th;
    for(var mr=0;mr<o.h;mr++)for(var mc=0;mc<o.w;mc++){ if(o.d[(mr*o.w+mc)*4+3]<80)continue;
      var c0=((ox+mc*sc)/cell)|0,c1=((ox+(mc+1)*sc)/cell)|0,r0=((oy+mr*sc)/cell)|0,r1=((oy+(mr+1)*sc)/cell)|0;
      for(var R=r0;R<=r1;R++)for(var C=c0;C<=c1;C++){ if(C<0||R<0||C>=cols||R>=rows)continue; var id=R*cols+C, ww=0.55+0.38*pop; if(ww>heat[id])heat[id]=ww; } } }
  /* ===== easter eggs ===== */
  var wMask=document.createElement('canvas'), wmx=wMask.getContext('2d'), wData=null, wW=0, wH=14, eggUntil=0, heartUntil=0;
  function buildWord(txt){ wmx.font='bold 12px "Sneak",monospace'; wW=Math.max(8,Math.ceil(wmx.measureText(txt).width)); wMask.width=wW; wMask.height=wH; wmx.font='bold 12px "Sneak",monospace'; wmx.textBaseline='middle'; wmx.fillStyle='#000'; wmx.clearRect(0,0,wW,wH); wmx.fillText(txt,0,wH/2); wData=wmx.getImageData(0,0,wW,wH).data; }
  function stampWord(){ if(!wData)return; var tw=Math.min(W*0.7,(H*0.45)*(wW/wH)), sc=tw/wW, ox=(W-tw)/2, oy=(H-sc*wH)/2;
    for(var mr=0;mr<wH;mr++)for(var mc=0;mc<wW;mc++){ if(wData[(mr*wW+mc)*4+3]<80)continue; var c0=((ox+mc*sc)/cell)|0,c1=((ox+(mc+1)*sc)/cell)|0,r0=((oy+mr*sc)/cell)|0,r1=((oy+(mr+1)*sc)/cell)|0;
      for(var R=r0;R<=r1;R++)for(var C=c0;C<=c1;C++){ if(C<0||R<0||C>=cols||R>=rows)continue; var id=R*cols+C, ww=0.8+0.18*Math.sin((C*0.5+R*0.5)-t*0.012); if(ww>heat[id])heat[id]=ww; } } }
  function stampBigHeart(){ var gw=9,gh=8, tw=Math.min(W*0.42,H*0.55*(gw/gh)), sc=tw/gw, ox=(W-gw*sc)/2, oy=(H-gh*sc)/2;
    for(var k=0;k<HEART.length;k++){ var c0=((ox+HEART[k][0]*sc)/cell)|0,c1=((ox+(HEART[k][0]+1)*sc)/cell)|0,r0=((oy+HEART[k][1]*sc)/cell)|0,r1=((oy+(HEART[k][1]+1)*sc)/cell)|0;
      for(var R=r0;R<=r1;R++)for(var C=c0;C<=c1;C++){ if(C<0||R<0||C>=cols||R>=rows)continue; var id=R*cols+C, ww=0.82+0.12*Math.sin((C*0.5+R*0.5)-t*0.01); if(ww>heat[id])heat[id]=ww; } } }
  function burst(n,pow){ var b=performance.now()/1000; for(var i=0;i<n;i++) waves.push({x:Math.random()*W, y:Math.random()*H, t0:b, pow:pow*(0.6+Math.random())}); shake=Math.max(shake,1.6); }
  function fireWild(){ buildWord('WILD'); eggUntil=performance.now()/1000+3.4; burst(12,1.1); }
  function fireHeart(){ heartUntil=performance.now()/1000+3.4; burst(8,0.9); }
  var KON=[38,38,40,40,37,39,37,39,66,65], ki=0, typed='';
  addEventListener('keydown',function(e){ var k=e.keyCode;
    if(k===KON[ki]){ ki++; if(ki===KON.length){ ki=0; fireWild(); } } else { ki=(k===KON[0])?1:0; }
    if(e.key&&e.key.length===1){ typed=(typed+e.key.toLowerCase()).slice(-6); if(typed.slice(-4)==='wild') fireWild(); else if(typed==='vienna') fireHeart(); } });
  addEventListener('dblclick',function(e){ if(TOUCH) return; if(e.target.closest&&e.target.closest('a,button,input,.pxctl'))return; waves.push({x:e.clientX,y:e.clientY,t0:performance.now()/1000,pow:2.8}); dep(e.clientX,e.clientY,1,BRUSH*22); shake=2.4; });
  function render(){ var tt=t*0.001, ns=performance.now()/1000;
    /* hero rect drives the headline + its safe zone */
    var hb=hero.getBoundingClientRect(); hrTop=hb.top; hrH=hb.height;
    var heroVis = hb.bottom>0 && hb.top<H;
    var intro=introT/1.6;                                 /* on-load reveal: random pixels scatter in over ~1.6s */
    /* content rects (viewport) the pixels must avoid: copy & images. Padding varies per block (some generous),
       and a fuzzy band gives a ragged, random edge rather than a clean rectangle. */
    var safes=[], i, b;
    for(i=0;i<pxsafeEls.length;i++){ b=pxsafeEls[i].getBoundingClientRect(); if(b.width>0 && b.bottom>0 && b.top<H){
      var ep=10 + (i*53 % 5)*8;                           /* 10,18,26,34,42 px: more generous in some cases */
      safes.push([b.left-ep, b.top-ep*0.7, b.right+ep, b.bottom+ep*0.7, cell*2.4]); } }
    for(i=0;i<heat.length;i++){
      if(dis[i]>0 && ((i/cols)|0)*cell>hb.bottom){ dis[i]-=0.007;          /* below the hero: hold red, then dissolve to white */
        if(dis[i]<=0){ dis[i]=0; heat[i]=0; }
        else if(dis[i]<0.3){ heat[i]*=0.88; }
        else { heat[i]=Math.max(heat[i]*0.95, 0.9); } }
      else { if(dis[i]>0)dis[i]=0; heat[i]*=(TOUCH?0.85:0.878); if(heat[i]<.003)heat[i]=0; } }   /* short, fast-fading trail everywhere (matches the old footer feel) */
    if(TOUCH){ var sp=scrollY, vc=H*0.5, bx, by, mhd=null;               /* no cursor on touch: the blob eases along a scroll path */
      for(var mi=0;mi<headElsM.length;mi++){ var mr=headElsM[mi].getBoundingClientRect(); if(mr.width<2)continue; var mcy=mr.top+mr.height/2; if(mcy>H*0.30 && mcy<H*0.64){ mhd={x:mr.left+mr.width/2, y:mcy}; break; } }   /* a tagged headline near the middle -> point the auto-blob at it */
      if(mhd){ cursorZone=''; var tprog=(H*0.64-mhd.y)/(H*0.34); tprog=tprog<0?0:tprog>1?1:tprog;   /* how far the headline has scrolled up through the band */
        bx=mhd.x+(tprog-0.5)*W*0.5; by=mhd.y-104; hoverSlide=null; }                                  /* sit above it and sweep across as you scroll, so the arrow rotates to keep pointing down at it */
      else {
        cursorZone = spans(secOrigin,vc)?'heart' : ((spans(secContact,vc)||spans(footEl,vc))?'text':'');
        if(cursorZone){ bx=W*0.5+Math.sin(sp*0.0026+0.6)*W*0.33; by=H*0.5+Math.sin(sp*0.0052)*H*0.20; hoverSlide=null; }
        else { var g=activeGroup(vc);
          if(g){ bx=g.x; by=g.y; hoverSlide=g.frame?g.el:null; }
          else { var tg=nearestTarget(vc);
            if(tg){ var tr=tg.getBoundingClientRect(); bx=tr.left+tr.width/2; by=tr.top+tr.height/2; hoverSlide=tg; }
            else { bx=W*0.5+Math.sin(sp*0.0026+0.6)*W*0.33; by=H*0.5+Math.sin(sp*0.0052)*H*0.20; hoverSlide=null; } } }
      }
      if(mx<0)mx=bx; if(my<0)my=by;
      mx += (bx-mx)*0.11; my += (by-my)*0.11;                   /* gentler ease => visits each tile in order, less momentum jitter */
      mx=Math.max(8,Math.min(W-8,mx)); my=Math.max(8,Math.min(H-8,my)); hov=true; lastMove=ns; }   /* touch: always "active" (scroll-follow), never idles into Pac-Man */
    if(hov&&mx>0){
      var hd = TOUCH ? mhd : nearHeadline(mx,my,headEls), idle = ns-lastMove;
      if(hd){                                                                                /* near a headline: keep pointing at it, then wander off when idle */
        if(idle<2.4){ pointArrow(mx,my, Math.atan2(hd.y-my, hd.x-mx), ns); pmx=mx;pmy=my; }
        else { wander(mx,my,ns); pmx=mx;pmy=my; }
      }
      else if(cursorZone==='heart'){ if(!wasHeart) heartBoom(mx,my); stampHeart(mx,my); pmx=mx;pmy=my; }   /* origin story: a big heart that pops in with a little explosion */
      else if(cursorZone==='text'){ follow(mx,my, my>hb.bottom?BRUSH*0.5:BRUSH); }   /* keep the follow-blob in the CTA; the marquee runs independently on top */
      else {
        var sg=null, sp=0;                                                          /* find the nearest smiley and how close (0..1); runs on touch too so the scroll-follow blob fills the face */
        for(var qi=0;qi<smileyEls.length;qi++){ var qr=smileyEls[qi].el.getBoundingClientRect(); if(qr.width<2||qr.bottom<-40||qr.top>H+40)continue;
          var qcx=qr.left+qr.width/2, qcy=qr.top+qr.height/2, GR=qr.width*1.9, qp=1-Math.hypot(mx-qcx,my-qcy)/GR;
          if(qp>sp){ sp=qp; sg={cx:qcx,cy:qcy,rad:qr.width*0.46,val:smileyEls[qi].val}; } }
        if(sg && sp>0){ var e=sp*sp*(3-2*sp), bx=mx+(sg.cx-mx)*e, by=my+(sg.cy-my)*e;   /* stronger pull (wider reach) toward the face... */
          if(e<0.82) dep(bx,by,0.13, BRUSH*(1-0.5*e));
          if(sp>0.16) stampDisk(sg.cx, sg.cy, sg.rad*e, sg.val); pmx=mx;pmy=my; }      /* ...and blooms into it, becoming the face's colour */
        else if(idle>1.5){ wander(mx,my,ns); pmx=mx;pmy=my; }                          /* inactive: turn into a Pac-Man and wander off */
        else follow(mx,my, (my>hb.bottom?BRUSH*0.5:BRUSH));                            /* steady size (no velocity growth) */
      }
      wasHeart=(cursorZone==='heart');
    }
    /* heart explosion sparks: fly out from the heart and fade */
    for(var hi=hsparks.length-1;hi>=0;hi--){ var hsp=hsparks[hi]; hsp.x+=hsp.vx; hsp.y+=hsp.vy; hsp.vx*=0.88; hsp.vy*=0.88; hsp.life-=0.06;
      if(hsp.life<=0){ hsparks.splice(hi,1); continue; } dep(hsp.x, hsp.y, 0.45+0.45*hsp.life, 1.6); }
    /* bottom marquee: always on, locked above the CTA paragraph, independent of the cursor */
    if(ctaMeta){ var _mr=ctaMeta.getBoundingClientRect();
      if(_mr.bottom>0 && _mr.top<H+260){ txtScroll+=0.14; stampText(0, _mr.top-(TOUCH?195:235)); } }   /* sit the marquee a touch lower on phones; global decay matches so no extra pass needed */
    if(ns<eggUntil) stampWord(); if(ns<heartUntil) stampBigHeart();
    if(charging){ var chg=Math.min((ns-chT0)/2.2,1); dep(chx,chy, 0.45+chg*0.5, BRUSH*(2+chg*8)); if(shake<0.12+chg*0.35) shake=0.12+chg*0.35; }
    /* (hover frame is drawn straight to canvas after the field, so it never streaks the heat on scroll) */
    for(var wi=waves.length-1;wi>=0;wi--){ var wv=waves[wi], age=ns-wv.t0; if(age>1.5){waves.splice(wi,1);continue;}
      var pw=wv.pow||1, R=age*Math.hypot(W,H)*1.7, sig=cell*5.5*pw, amp=Math.max(0,1-age/1.5)*1.2*pw, inv=1/(2*sig*sig);
      for(var r=0;r<rows;r++)for(var c=0;c<cols;c++){ var dx=(c+.5)*cell-wv.x, dy=(r+.5)*cell-wv.y, dd=Math.sqrt(dx*dx+dy*dy), g=amp*Math.exp(-((dd-R)*(dd-R))*inv); if(g>0.02){ var id=r*cols+c; if(g>heat[id])heat[id]=g;
        if((r+0.5)*cell>hb.bottom && g>0.25 && dis[id]===0) dis[id]=0.45+hsh(c,r)*0.7; } } }
    sData=null;
    ctx.save(); if(shake>0.01){ shake*=0.9; ctx.translate((Math.random()-0.5)*shake*20,(Math.random()-0.5)*shake*20); } else shake=0;
    ctx.clearRect(-40,-40,W+80,H+80); ctx.fillStyle='#fff'; ctx.fillRect(-40,-40,W+80,H+80);
    /* grid + field are document-aligned, so they scroll with the page instead of being pinned to the viewport */
    var sy=TOUCH?0:scrollY, off=sy-Math.floor(sy/cell)*cell, s=cell-1;   /* on touch, lock the field to the viewport so iOS momentum scroll cannot make it jitter */
    ctx.strokeStyle='#fafafa'; ctx.lineWidth=1; ctx.beginPath();
    for(var gx=0;gx<=W;gx+=cell){ctx.moveTo(gx+.5,0);ctx.lineTo(gx+.5,H);}
    for(var gy=-off;gy<=H;gy+=cell){ctx.moveTo(0,gy+.5);ctx.lineTo(W,gy+.5);}
    ctx.stroke();
    var drStart=Math.floor(sy/cell)-1, drEnd=Math.floor((sy+H)/cell)+1;
    /* colour field is full below the header through the viewport, then fades out (ragged) by the next section */
    if(fhb<0) fhb=hb.bottom; else fhb += (hb.bottom-fhb)*(TOUCH?0.2:1);   /* ease the fade edge on touch so it glides instead of stepping */
    var hAmp=H*0.14, heroBottom=fhb+sy, heroEnd=heroBottom*0.55, fadeSpan=Math.max(1, heroBottom*0.18);   /* H (cached) not live innerHeight; span clamped positive so field is fully off past the hero */
    for(var dr=drStart; dr<=drEnd; dr++){
      var vy=dr*cell-sy, ccyView=vy+cell*0.5, vr=Math.floor(ccyView/cell), inRow=(vr>=0&&vr<rows);
      var dd=dr*cell, ny=(dr*cell)/H;
      for(var c2=0;c2<cols;c2++){ var ccx=(c2+.5)*cell, nx=(c2*cell)/innerWidth;
        /* ragged & random cutoff: smooth column waves + blocky random patches fade out earlier (below the viewport) */
        var co=Math.max(0,(Math.sin(c2*0.5+SEED)+Math.sin(c2*0.21-SEED*1.3))*0.16 + hsh(Math.floor(c2/2)+3.3,Math.floor(dr/4))*0.6 + 0.15), depthN=dd+co*hAmp;
        var regThr=depthN<=heroEnd?0:Math.min(1,(depthN-heroEnd)/fadeSpan);
        var safe=false; for(var si=0;si<safes.length;si++){ var sf=safes[si];
          if(ccx>=sf[0]&&ccx<=sf[2]&&ccyView>=sf[1]&&ccyView<=sf[3]){ safe=true; break; }              /* core */
          var fz=sf[4]; if(ccx>=sf[0]-fz&&ccx<=sf[2]+fz&&ccyView>=sf[1]-fz&&ccyView<=sf[3]+fz && hsh(c2+9.1,dr+4.7)<0.55){ safe=true; break; } }   /* ragged edge */
        if(safe) continue;                                   /* keep the masthead title clear */
        var v=inRow?heat[vr*cols+c2]*0.9:0;                  /* cursor heat / explosion paints anywhere */
        if(region(nx,ny,tt) > regThr && hsh(c2*1.7+11.3, dr*1.3+5.1) < intro){   /* ambient field: clustered in blobs, revealed by intro */
          v += base(nx,ny,tt)+(hsh(c2,dr)-0.5)*0.12+Math.sin((c2*0.6+dr*0.8)+tt*1.7)*0.045; }
        if(v<0.30 && !(v>=0.86&&v<1.02))continue; var col=BANDS[0][1]; if(v>=BANDS[1][0])col=BANDS[1][1]; if(v>=BANDS[2][0])col=BANDS[2][1]; if(v>=BANDS[3][0])col=BANDS[3][1]; if(v>=0.86&&v<1.02)col='#d8ff00';
        ctx.fillStyle=col; ctx.fillRect(c2*cell, vy, s, s); } }
    ctx.restore();
  }
  function loop(ts){ if(!loop.l)loop.l=ts; var d=ts-loop.l; loop.l=ts; t+=d; typeT+=d/1000; introT+=d/1000;
    render(); requestAnimationFrame(loop); }
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){ size(); });
  requestAnimationFrame(loop);

  /* cell / brush size controls */
  var pxctl=document.getElementById('pxctl');
  if(pxctl){ pxctl.addEventListener('click', function(e){ var btn=e.target.closest('button'); if(!btn) return;
    function pick(attr){ pxctl.querySelectorAll('button[data-'+attr+']').forEach(function(x){ x.classList.remove('on'); }); btn.classList.add('on'); }
    if(btn.dataset.cell!=null){ cell=+btn.dataset.cell; size(); pick('cell'); }
    else if(btn.dataset.brush!=null){ BRUSH=+btn.dataset.brush; pick('brush'); }
  }); }
})();

/* ===== reveals ===== */
(function(){ var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); },{threshold:0.1, rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){
    var i=0, s=el.previousElementSibling;                                  /* index among .reveal siblings */
    while(s){ if(s.classList && s.classList.contains('reveal')) i++; s=s.previousElementSibling; }
    if(i) el.style.transitionDelay=(i*0.12)+'s';                           /* stagger so the headline leads and section content follows */
    io.observe(el); }); })();
/* intro lead: split into rendered lines and reveal them line by line */
(function(){
  var lead=document.querySelector('.intro .lead'); if(!lead) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){ lead.classList.add('ready'); return; }
  var orig=lead.innerHTML, revealed=false;
  function split(){
    lead.innerHTML=orig;
    if(!lead.clientWidth) return false;                                    /* not laid out yet */
    var toks=[];
    [].forEach.call(lead.childNodes, function(n){
      var em = n.nodeType===1 && n.tagName==='EM';
      String(n.textContent).split(/(\s+)/).forEach(function(p){ if(p.length) toks.push({t:p, em:em, sp:/^\s+$/.test(p)}); });
    });
    lead.textContent='';
    var ws=toks.map(function(tk){ var s=document.createElement('span'); s.textContent=tk.t; if(tk.em) s.style.color='var(--muted)'; if(tk.sp) s.setAttribute('data-sp','1'); lead.appendChild(s); return s; });
    var lines=[], cur=null, top=null;
    ws.forEach(function(s){
      if(s.getAttribute('data-sp') && top===null) return;                  /* skip a leading space */
      var t=s.offsetTop;
      if(top===null || Math.abs(t-top)>2){ cur=[]; lines.push(cur); top=t; }
      cur.push(s);
    });
    lead.textContent='';
    lines.forEach(function(arr,i){
      var ln=document.createElement('span'); ln.className='ln';
      var inner=document.createElement('span'); inner.style.transitionDelay=(i*0.1)+'s';   /* each line a beat after the last */
      arr.forEach(function(s){ s.removeAttribute('data-sp'); inner.appendChild(s); });
      ln.appendChild(inner); lead.appendChild(ln);
    });
    lead.classList.add('ready');                                            /* lines are in place (translated out of view) - safe to show without flashing raw text */
    if(revealed) lead.classList.add('in');
    return true;
  }
  function init(){
    if(!split()){ requestAnimationFrame(init); return; }                   /* wait until it has a width */
    new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ revealed=true; lead.classList.add('in'); } }); },{threshold:0}).observe(lead);   /* reveal as soon as any part is visible */
    var rt; addEventListener('resize', function(){ clearTimeout(rt); rt=setTimeout(function(){ lead.classList.remove('in'); split(); }, 200); });   /* re-flow lines on resize */
  }
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();
})();
