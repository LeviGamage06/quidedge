/* QuidEdge motion direction. Visual only: no navigation, data or submission changes. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const animations=new Set(), observed=new WeakSet(), listeners=[];
  const ease='cubic-bezier(.16,1,.3,1)';
  let observer, mutation, frame=0, stopped=reduced.matches;
  const root=document.documentElement;
  const on=(el,name,fn,options)=>{el.addEventListener(name,fn,options);listeners.push(()=>el.removeEventListener(name,fn,options));};
  const play=(el,keys,options={})=>{
    if(stopped||document.hidden||!el?.animate)return;
    const a=el.animate(keys,{duration:900,easing:ease,...options});animations.add(a);
    a.finished.then(()=>animations.delete(a),()=>animations.delete(a));return a;
  };
  document.querySelectorAll('#site-header .nav-item').forEach(link=>{
    if(new URL(link.href).pathname.replace(/\/$/,'')===location.pathname.replace(/\/$/,''))link.setAttribute('aria-current','page');
  });
  if(stopped)return;
  root.classList.add('qe-motion-on');
  // The message arrives first; the work composition resolves next; the CTA stays accessible.
  document.querySelectorAll('.qe-brand-headline .lm-i').forEach((el,i)=>{
    play(el,[{opacity:0,clipPath:'inset(0 0 100% 0)',transform:'translateY(55px) rotate(3deg)'},{opacity:1,clipPath:'inset(0 0 0% 0)',transform:'translateY(0) rotate(0deg)'}],{duration:1150,delay:70+i*140,fill:'backwards'});
  });
  const collage=document.querySelector('.qe-work-collage');
  if(collage){
    play(collage.querySelector('.qe-visual-main'),[{opacity:0,transform:'translate3d(45px,38px,0) rotate(10deg) scale(.91)',clipPath:'inset(0 0 100% 0 round 30px)'},{opacity:1,transform:'translate3d(0,0,0) rotate(3deg) scale(1)',clipPath:'inset(0 0 0% 0 round 0px)'}],{duration:1350,delay:140,fill:'backwards'});
    play(collage.querySelector('.qe-visual-small'),[{opacity:0,transform:'translateY(55px) rotate(6deg) scale(.86)'},{opacity:1,transform:'translateY(0) rotate(-6deg) scale(1)'}],{duration:1100,delay:430,fill:'backwards'});
    play(collage.querySelector('.qe-visual-word'),[{opacity:0,transform:'translateY(30px) rotate(-18deg) scale(.7)'},{opacity:1,transform:'translateY(0) rotate(-8deg) scale(1)'}],{duration:1100,delay:530,fill:'backwards'});
  }
  const selector='main h2, .qe-fit-grid>a, main .service-row, main .card, .qe-scope-grid>article, .qe-about .media, .qe-service-context>.max-w-7xl>div, main .faq-btn, .qe-service-questions details';
  function watch(el){if(observed.has(el))return;observed.add(el);observer?.observe(el);}
  if('IntersectionObserver' in window){
    observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting);
      visible.forEach((entry,i)=>{
        observer.unobserve(entry.target);
        const el=entry.target;if(stopped||document.hidden)return;
        const heading=el.tagName==='H2';
        const card=el.matches('.card,.qe-fit-grid>a,.service-row,.qe-scope-grid>article');
        const delay=Math.min(i*(card?85:55),255);
        const keys=heading?[{opacity:.1,clipPath:'inset(0 0 100% 0)',transform:'translateY(25px)'},{opacity:1,clipPath:'inset(0 0 0% 0)',transform:'translateY(0)'}]:[{opacity:.12,transform:`translateY(${card?50:25}px) scale(${card?.975:1})`},{opacity:1,transform:'translateY(0) scale(1)'}];
        play(el,keys,{duration:card?1000:850,delay});
      });
    },{threshold:.1,rootMargin:'0px 0px -25px 0px'});
    document.querySelectorAll(selector).forEach(watch);
    const cases=document.getElementById('home-cases');
    if(cases){mutation=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1&&n.matches('.card')){watch(n);bindSurface(n);}})));mutation.observe(cases,{childList:true});}
  }
  // Desktop-only light response is bounded to each surface. It never displaces a button.
  const bound=new WeakSet();
  function bindSurface(el){
    if(!fine.matches||bound.has(el)||stopped)return;bound.add(el);el.classList.add('qe-light-surface');
    let raf=0,x=.5,y=.5;
    on(el,'pointermove',e=>{
      if(stopped)return;const b=el.getBoundingClientRect();x=(e.clientX-b.left)/b.width;y=(e.clientY-b.top)/b.height;
      if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(stopped)return;el.style.setProperty('--qe-light-x',`${Math.round(x*100)}%`);el.style.setProperty('--qe-light-y',`${Math.round(y*100)}%`);});
    },{passive:true});
    on(el,'pointerleave',()=>{if(raf){cancelAnimationFrame(raf);raf=0;}el.style.removeProperty('--qe-light-x');el.style.removeProperty('--qe-light-y');},{passive:true});
  }
  document.querySelectorAll('.qe-fit-grid>a,.service-row,.qe-scope-grid>article,#packages .card').forEach(bindSurface);
  if(collage&&fine.matches){
    const front=collage.querySelector('.qe-visual-main'),back=collage.querySelector('.qe-visual-small');
    let raf=0,x=0,y=0;
    const render=()=>{raf=0;if(stopped)return;front.style.transform=`perspective(1000px) rotateY(${x*5}deg) rotateX(${-y*4}deg) rotate(${3+x}deg)`;back.style.transform=`translate3d(${-x*13}px,${-y*10}px,0) rotate(${-6-x*2}deg)`;};
    on(collage,'pointermove',e=>{const b=collage.getBoundingClientRect();x=(e.clientX-b.left)/b.width-.5;y=(e.clientY-b.top)/b.height-.5;if(!raf)raf=requestAnimationFrame(render);},{passive:true});
    on(collage,'pointerleave',()=>{x=y=0;if(!raf)raf=requestAnimationFrame(render);},{passive:true});
  }
  // Cinematic reel widens with natural scroll. No pinned scrolling, scroll locking or added page height.
  const reel=document.querySelector('.qe-reel');
  function renderScroll(){
    frame=0;if(stopped||document.hidden||!reel)return;
    const b=reel.getBoundingClientRect(),h=window.innerHeight;
    if(b.bottom<=0||b.top>=h)return;
    const p=Math.max(0,Math.min(1,(h-b.top)/(h*.7)));
    reel.style.setProperty('--qe-reel-inset',`${(1-p)*(fine.matches?6:2)}%`);
    const video=reel.querySelector('video');if(video)video.style.transform=`scale(${1.075-p*.075})`;
  }
  if(reel){on(window,'scroll',()=>{if(!frame)frame=requestAnimationFrame(renderScroll);},{passive:true});on(window,'resize',()=>{if(!frame)frame=requestAnimationFrame(renderScroll);},{passive:true});renderScroll();}
  on(document,'visibilitychange',()=>{animations.forEach(a=>{if(document.hidden)a.pause();else if(!stopped)a.play();});if(!document.hidden&&!frame)frame=requestAnimationFrame(renderScroll);});
  reduced.addEventListener('change',e=>{
    if(!e.matches)return;stopped=true;root.classList.remove('qe-motion-on');
    animations.forEach(a=>a.cancel());animations.clear();observer?.disconnect();mutation?.disconnect();listeners.forEach(remove=>remove());
    if(frame)cancelAnimationFrame(frame);
    document.querySelectorAll('.qe-visual-main,.qe-visual-small,.qe-reel video').forEach(el=>el.style.removeProperty('transform'));
    reel?.style.removeProperty('--qe-reel-inset');
  });
})();
