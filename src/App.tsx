import { useState, useEffect, useRef, useCallback } from 'react';
import './styles/slides.css';
import './App.css';

/* ─── 슬라이드 타입 ─── */
interface SlideItem {
  /** HTML 슬라이드용 */
  html?: string;
  /** TSX 슬라이드용 */
  Component?: React.ComponentType;
  title: string;
  num: string;
  isChapter: boolean;
}

/* ─── HTML 슬라이드 파싱 ─── */
const htmlModules = import.meta.glob<string>('./slides/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/* ─── TSX 슬라이드 (default export 컴포넌트) ─── */
const tsxModules = import.meta.glob<{ default: React.ComponentType; meta?: { title: string; num: string; isChapter?: boolean } }>(
  './slides/*.tsx',
  { eager: true }
);

function parseHtmlSlide(html: string): SlideItem {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const el = doc.querySelector('.slide')!;
  const isChapter = el.classList.contains('schap');
  const num = el.querySelector('.slide-no')?.textContent?.trim() ?? '';

  let title = '';
  if (isChapter) {
    title = el.querySelector('.schap-title')?.textContent?.trim() ?? 'Chapter';
  } else {
    const badge = el.querySelector('.sec-badge')?.textContent?.trim();
    const headingEl = el.querySelector('[class$="-heading"]') ?? el.querySelector('[class*="-heading"]');
    title = badge ?? headingEl?.textContent?.trim().slice(0, 40) ?? `슬라이드 ${num}`;
  }

  return { html: el.outerHTML, title, num, isChapter };
}

/* ─── HTML + TSX 합쳐서 파일명 순 정렬 ─── */
const allEntries: [string, SlideItem][] = [
  ...Object.entries(htmlModules).map(([path, raw]): [string, SlideItem] => [
    path,
    parseHtmlSlide(raw as string),
  ]),
  ...Object.entries(tsxModules).map(([path, mod]): [string, SlideItem] => {
    const m = (mod as { default: React.ComponentType; meta?: { title: string; num: string; isChapter?: boolean } });
    return [
      path,
      {
        Component: m.default,
        title: m.meta?.title ?? path.split('/').pop()!.replace('.tsx', ''),
        num: m.meta?.num ?? '',
        isChapter: m.meta?.isChapter ?? false,
      },
    ];
  }),
];

const slides: SlideItem[] = allEntries
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, slide]) => slide);

/* ─── HTML / TSX 통합 렌더러 ─── */
function SlideRenderer({ slide }: { slide: SlideItem }) {
  if (slide.Component) return <slide.Component />;
  return <div dangerouslySetInnerHTML={{ __html: slide.html ?? '' }} />;
}

/* ─── 앱 ─── */
export default function App() {
  const [mode, setMode] = useState<'scroll' | 'present'>('scroll');
  const [current, setCurrent] = useState(0);

  /* 전역 슬라이드 점프 함수 (TOC에서 사용) */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__goToSlide = (idx: number) => {
      if (mode === 'present') {
        setCurrent(idx);
      } else {
        const el = document.getElementById(`slide-${idx}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  }, [mode]);
  const [scale, setScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  /* CSS는 import로 처리되므로 동적 주입 불필요 */

  /* 프레젠테이션 모드 스케일 계산 */
  const calcScale = useCallback(() => {
    if (!stageRef.current) return;
    const w = stageRef.current.clientWidth;
    const h = stageRef.current.clientHeight;
    setScale(Math.min(w / 1280, h / 720) * 0.96);
  }, []);

  useEffect(() => {
    if (mode !== 'present') return;
    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, [mode, calcScale]);

  /* 키보드 네비게이션 */
  useEffect(() => {
    if (mode !== 'present') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setCurrent((c) => Math.min(slides.length - 1, c + 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrent((c) => Math.max(0, c - 1));
      }
      if (e.key === 'Escape') setMode('scroll');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode]);

  /* 썸네일 자동 스크롤 */
  useEffect(() => {
    if (mode !== 'present' || !thumbRef.current) return;
    const active = thumbRef.current.querySelector('.thumb-btn.active') as HTMLElement;
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [current, mode]);

  const goPrev = () => setCurrent((c) => Math.max(0, c - 1));
  const goNext = () => setCurrent((c) => Math.min(slides.length - 1, c + 1));

  /* ── 프레젠테이션 모드 ── */
  if (mode === 'present') {
    return (
      <div className="present-root">
        {/* 상단 바 */}
        <div className="present-topbar">
          <button className="tb-btn" onClick={() => setMode('scroll')} title="스크롤 모드">
            ☰ 스크롤
          </button>
          <div className="tb-nav">
            <button className="tb-btn tb-arrow" onClick={goPrev} disabled={current === 0}>◀</button>
            <span className="tb-counter">
              {current + 1} <span className="tb-slash">/</span> {slides.length}
            </span>
            <button className="tb-btn tb-arrow" onClick={goNext} disabled={current === slides.length - 1}>▶</button>
          </div>
          <div className="tb-title">{slides[current].title}</div>
          <div className="tb-hint">← → 키 · ESC 종료</div>
        </div>

        {/* 슬라이드 무대 */}
        <div className="present-stage" ref={stageRef}>
          <div
            className="present-slide-wrap"
            style={{ transform: `scale(${scale})` }}
          >
            <SlideRenderer slide={slides[current]} />
          </div>
        </div>

        {/* 하단 썸네일 스트립 */}
        <div className="thumb-strip" ref={thumbRef}>
          {slides.map((s, i) => (
            <button
              key={i}
              className={`thumb-btn${i === current ? ' active' : ''}${s.isChapter ? ' chapter' : ''}`}
              onClick={() => setCurrent(i)}
              title={s.title}
            >
              <span className="thumb-num">{s.isChapter ? '—' : (s.num || String(i + 1))}</span>
              <span className="thumb-title">{s.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── 스크롤 모드 ── */
  return (
    <div className="scroll-root">
      {/* 고정 헤더 */}
      <div className="scroll-header">
        <div className="scroll-header-left">
          <span className="header-brand">CoGLabs</span>
          <span className="header-sub">사업계획서 v2 · 2026</span>
          <span className="header-count">{slides.length}페이지</span>
        </div>
        <button
          className="present-btn"
          onClick={() => { setCurrent(0); setMode('present'); }}
        >
          ▶ 프레젠테이션 모드
        </button>
      </div>

      {/* 슬라이드 목록 */}
      <div className="scroll-body">
        {slides.map((s, i) => (
          <div key={i} id={`slide-${i}`} className="scroll-slide-wrapper">
            <SlideRenderer slide={s} />
          </div>
        ))}
      </div>
    </div>
  );
}
