import React, { useEffect, useRef, useState } from 'react';
import { Fan, Pause, Zap, Info, X } from 'lucide-react';
import { GpuAdapter, NvidiaTelemetry } from '../types/gpu';

interface GpuVisualCardProps {
  gpu: GpuAdapter | undefined;
  telemetry: NvidiaTelemetry | null;
}

const FanBlades: React.FC<{
  cx: number;
  cy: number;
  r: number;
  hubColor: string;
  ringColor: string;
  bladeColor: string;
  durationSec: number;
  paused: boolean;
}> = ({ cx, cy, r, hubColor, ringColor, bladeColor, durationSec, paused }) => {
  const blades = Array.from({ length: 9 }, (_, i) => i * 40);

  return (
    <g>
      {/* Fan Shroud Cutout */}
      <circle cx={cx} cy={cy} r={r + 4} fill="#070908" stroke={ringColor} strokeWidth="1.5" strokeOpacity="0.55" />
      <circle cx={cx} cy={cy} r={r + 1.5} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      {/* Rotating Rotor Group */}
      <g
        className={`gpu-fan-spin ${paused ? 'gpu-fan-paused' : ''}`}
        style={{ ['--fan-duration' as string]: `${durationSec}s` }}
      >
        {blades.map((angle) => (
          <path
            key={angle}
            d={`M ${cx} ${cy} Q ${cx + r * 0.45} ${cy - r * 0.45} ${cx + r * 0.92} ${cy - r * 0.14} A ${r * 0.92} ${
              r * 0.92
            } 0 0 1 ${cx + r * 0.78} ${cy + r * 0.42} Q ${cx + r * 0.35} ${cy + r * 0.15} ${cx} ${cy} Z`}
            fill={bladeColor}
            fillOpacity="0.92"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.4"
            transform={`rotate(${angle} ${cx} ${cy})`}
          />
        ))}
        {/* Center Metallic Hub */}
        <circle cx={cx} cy={cy} r={r * 0.34} fill="#181c1a" stroke={hubColor} strokeWidth="1.4" />
        <circle cx={cx} cy={cy} r={r * 0.16} fill={hubColor} fillOpacity="0.85" />
      </g>
    </g>
  );
};

export const GpuVisualCard: React.FC<GpuVisualCardProps> = ({ gpu, telemetry }) => {
  const [fanMode, setFanMode] = useState<'auto' | 'boost' | 'pause'>('auto');
  const [hovered, setHovered] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showSpec) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSpec(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSpec(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSpec]);

  const vendor = gpu?.vendor || 'nvidia';

  // Calculate dynamic spin duration from telemetry or interactive state
  const liveFanPct = vendor === 'nvidia' && telemetry?.available ? telemetry.fanSpeedPercent : null;
  let durationSec = 2.1;
  if (fanMode === 'boost' || hovered) {
    durationSec = 0.42;
  } else if (liveFanPct !== null && liveFanPct > 0) {
    // Map 20%-100% fan speed to 2.4s-0.45s
    durationSec = Math.max(0.45, 2.7 - (liveFanPct / 100) * 2.2);
  }
  const isPaused = fanMode === 'pause' || (fanMode === 'auto' && !hovered && liveFanPct === 0);

  const palette =
    vendor === 'amd'
      ? {
          shroudGrad: ['#2a181c', '#181012', '#100b0c'],
          accent: '#f43f5e',
          accentSoft: '#fb7185',
          badge: 'RADEON',
          subBadge: 'ADRENALIN',
          blade: '#261d20',
          tripleFan: true,
        }
      : vendor === 'intel'
      ? {
          shroudGrad: ['#14202b', '#0d151d', '#090e14'],
          accent: '#38bdf8',
          accentSoft: '#7dd3fc',
          badge: 'INTEL ARC',
          subBadge: 'XE HPG',
          blade: '#192633',
          tripleFan: false,
        }
      : {
          shroudGrad: ['#1e2520', '#131814', '#0c100d'],
          accent: '#a3e635',
          accentSoft: '#bef264',
          badge: 'GEFORCE RTX',
          subBadge: gpu?.name?.match(/RTX\s*\d{4}(?:\s*Ti|\s*SUPER)?/i)?.[0] || 'FOUNDERS',
          blade: '#202622',
          tripleFan: true,
        };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-end justify-center select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Interactive Hardware Render Card */}
      <div
        onClick={() => setShowSpec((s) => !s)}
        title="点击查看显卡硬件参数 · 悬停可加速风扇"
        className="relative cursor-pointer group rounded-2xl p-2 transition-transform duration-300 hover:scale-[1.02]"
      >
        <svg
          viewBox="0 0 360 158"
          className="w-[310px] xl:w-[346px] h-auto drop-shadow-[0_14px_26px_rgba(0,0,0,0.75)]"
        >
          <defs>
            <linearGradient id={`shroud-${vendor}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.shroudGrad[0]} />
              <stop offset="55%" stopColor={palette.shroudGrad[1]} />
              <stop offset="100%" stopColor={palette.shroudGrad[2]} />
            </linearGradient>
            <linearGradient id={`gold-pcie-${vendor}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id={`heatsink-${vendor}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3f3f46" />
              <stop offset="50%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>
          </defs>

          {/* Left PCIe I/O Bracket */}
          <path
            d="M 12 20 L 22 20 L 22 146 L 16 146 L 16 138 L 12 138 Z"
            fill="#52525b"
            stroke="#71717a"
            strokeWidth="0.8"
          />
          <rect x="6" y="18" width="12" height="5" rx="1" fill="#71717a" />
          {/* DisplayPort / HDMI cut notches */}
          <rect x="13" y="34" width="5" height="12" rx="1" fill="#18181b" />
          <rect x="13" y="54" width="5" height="12" rx="1" fill="#18181b" />
          <rect x="13" y="74" width="5" height="12" rx="1" fill="#18181b" />

          {/* Copper Heatpipes & Aluminum Fin Stack peeking top/bottom */}
          <rect x="34" y="18" width="290" height="8" rx="2" fill={`url(#heatsink-${vendor})`} opacity="0.7" />
          {Array.from({ length: 28 }, (_, i) => (
            <line
              key={i}
              x1={42 + i * 10}
              y1="18"
              x2={42 + i * 10}
              y2="26"
              stroke="#18181b"
              strokeWidth="1.2"
            />
          ))}
          <rect x="52" y="12" width="256" height="4" rx="2" fill="#b45309" opacity="0.55" />

          {/* PCIe x16 Connector Tongue & Gold Fingers */}
          <path d="M 60 128 L 198 128 L 198 140 L 184 140 L 184 134 L 60 134 Z" fill="#143320" />
          <rect x="62" y="133" width="16" height="8" rx="1" fill={`url(#gold-pcie-${vendor})`} />
          <rect x="82" y="133" width="98" height="8" rx="1" fill={`url(#gold-pcie-${vendor})`} />
          {/* Retention Hook */}
          <path d="M 192 128 L 210 128 L 214 137 L 204 137 L 198 132 Z" fill="#143320" />

          {/* Main Shroud Body */}
          <path
            d="M 24 24 L 330 24 Q 344 24 344 38 L 344 114 Q 344 128 330 128 L 24 128 Z"
            fill={`url(#shroud-${vendor})`}
            stroke={hovered ? palette.accent : 'rgba(255,255,255,0.16)'}
            strokeWidth={hovered ? '1.6' : '1.1'}
          />

          {/* Machined Chamfer / X-Frame Aesthetic */}
          {vendor === 'nvidia' && (
            <g opacity="0.75">
              <path d="M 32 30 L 320 30 L 332 42 L 332 110 L 320 122 L 32 122 Z" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <line x1="128" y1="26" x2="146" y2="126" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
              <line x1="224" y1="26" x2="242" y2="126" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
            </g>
          )}
          {vendor === 'amd' && (
            <g>
              <rect x="36" y="25" width="286" height="3.5" rx="1.5" fill={palette.accent} opacity="0.9" />
              <path d="M 42 121 L 326 121" stroke={palette.accent} strokeWidth="1.5" strokeOpacity="0.45" />
            </g>
          )}
          {vendor === 'intel' && (
            <g>
              <rect
                x="30"
                y="29"
                width="308"
                height="94"
                rx="12"
                fill="none"
                stroke={palette.accent}
                strokeWidth="1.2"
                strokeOpacity="0.55"
              />
            </g>
          )}

          {/* Glowing Top Edge LED Bar */}
          <rect
            x="92"
            y="24"
            width="160"
            height="4"
            rx="2"
            fill={palette.accent}
            className="gpu-led-pulse"
          />
          <rect
            x="92"
            y="24"
            width="160"
            height="8"
            rx="4"
            fill={palette.accent}
            opacity={hovered ? '0.32' : '0.16'}
          />

          {/* 16-pin / 8-pin Power Connector */}
          <rect x="278" y="21" width="26" height="7" rx="1.5" fill="#09090b" stroke="#3f3f46" strokeWidth="0.9" />
          <circle cx="284" cy="24.5" r="1" fill="#a1a1aa" />
          <circle cx="290" cy="24.5" r="1" fill="#a1a1aa" />
          <circle cx="296" cy="24.5" r="1" fill="#a1a1aa" />

          {/* Brand Embossed Wordmark on Shroud */}
          <text
            x="40"
            y="37"
            fill={palette.accentSoft}
            fontSize="7.5"
            fontFamily="monospace"
            fontWeight="700"
            letterSpacing="1.5"
          >
            {palette.badge}
          </text>
          <text
            x="332"
            y="37"
            textAnchor="end"
            fill="rgba(255,255,255,0.45)"
            fontSize="6.5"
            fontFamily="monospace"
          >
            {palette.subBadge}
          </text>

          {/* Animated Axial Fans */}
          {palette.tripleFan ? (
            <>
              <FanBlades
                cx={80}
                cy={79}
                r={32}
                hubColor={palette.accent}
                ringColor={palette.accent}
                bladeColor={palette.blade}
                durationSec={durationSec}
                paused={isPaused}
              />
              <FanBlades
                cx={182}
                cy={79}
                r={32}
                hubColor={palette.accent}
                ringColor={palette.accent}
                bladeColor={palette.blade}
                durationSec={durationSec * 1.05}
                paused={isPaused}
              />
              <FanBlades
                cx={284}
                cy={79}
                r={32}
                hubColor={palette.accent}
                ringColor={palette.accent}
                bladeColor={palette.blade}
                durationSec={durationSec * 0.96}
                paused={isPaused}
              />
            </>
          ) : (
            <>
              <FanBlades
                cx={118}
                cy={79}
                r={36}
                hubColor={palette.accent}
                ringColor={palette.accent}
                bladeColor={palette.blade}
                durationSec={durationSec}
                paused={isPaused}
              />
              <FanBlades
                cx={248}
                cy={79}
                r={36}
                hubColor={palette.accent}
                ringColor={palette.accent}
                bladeColor={palette.blade}
                durationSec={durationSec * 1.04}
                paused={isPaused}
              />
            </>
          )}
        </svg>
      </div>

      {/* Subtle Fan / Spec Control Strip */}
      <div className="flex items-center gap-1.5 mr-2 -mt-1">
        <button
          onClick={() => setFanMode((m) => (m === 'auto' ? 'boost' : m === 'boost' ? 'pause' : 'auto'))}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/45 border border-white/[0.08] hover:border-white/20 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 transition"
          title="切换显卡风扇动画状态"
        >
          {fanMode === 'pause' ? (
            <Pause className="w-2.5 h-2.5" />
          ) : fanMode === 'boost' || hovered ? (
            <Zap className="w-2.5 h-2.5 accent-text" />
          ) : (
            <Fan className="w-2.5 h-2.5 accent-text" />
          )}
          <span>
            {fanMode === 'pause'
              ? '风扇暂停'
              : fanMode === 'boost'
              ? '演示高速'
              : liveFanPct !== null
              ? `转速 ${liveFanPct}%`
              : hovered
              ? '满速测试'
              : '动态运行'}
          </span>
        </button>

        <button
          onClick={() => setShowSpec((s) => !s)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono transition ${
            showSpec
              ? 'accent-soft'
              : 'bg-black/45 border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Info className="w-2.5 h-2.5" />
          <span>硬件参数</span>
        </button>
      </div>

      {/* Quick Spec Popover (outside SVG scale wrapper & unclipped by Hero banner) */}
      {showSpec && gpu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-2.5 z-50 w-80 rounded-xl bg-[#0e1410]/95 backdrop-blur-md border border-white/15 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-xs"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
            <div>
              <div className="font-semibold text-white">硬件详细规格</div>
              <div className="text-[10.5px] text-zinc-400 truncate max-w-[230px]" title={gpu.name}>
                {gpu.name}
              </div>
            </div>
            <button
              onClick={() => setShowSpec(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
              aria-label="关闭硬件详细规格"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">厂商 / 状态:</span>
              <span className="text-zinc-200">
                {gpu.adapterCompatibility || gpu.vendor.toUpperCase()} · {gpu.status}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">显存容量:</span>
              <span className="accent-text font-semibold">{gpu.vramLabel}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">驱动版本:</span>
              <span className="text-zinc-200">
                {gpu.friendlyVersion} ({gpu.driverVersion})
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">驱动日期:</span>
              <span className="text-zinc-200">{gpu.driverDate}</span>
            </div>
            {telemetry?.available && vendor === 'nvidia' && (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">功耗 / 上限:</span>
                  <span className="accent-text">
                    {telemetry.powerDrawW ?? '--'}W / {telemetry.powerLimitW ?? '--'}W
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">核心 / 显存频率:</span>
                  <span className="text-zinc-200">
                    {telemetry.graphicsClockMhz ?? '--'} / {telemetry.memoryClockMhz ?? '--'} MHz
                  </span>
                </div>
              </>
            )}
            <div className="pt-1.5 mt-1 text-[10px] text-zinc-500 break-all border-t border-white/10">
              {gpu.pnpDeviceId}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
