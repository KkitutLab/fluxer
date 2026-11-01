// SPDX-License-Identifier: AGPL-3.0-or-later

import type React from 'react';
import {useEffect, useReducer, useRef} from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

interface ZoomState {
	zoom: number;
	panX: number;
	panY: number;
}

/**
 * Wheel-to-zoom wrapper for watched screen shares. Zooms toward the cursor,
 * drags to pan while zoomed, double-click resets. Voice tiles otherwise
 * behave exactly as before.
 */
export function MediaZoom({children}: {children: React.ReactNode}) {
	const outerRef = useRef<HTMLDivElement>(null);
	const stateRef = useRef<ZoomState>({zoom: 1, panX: 0, panY: 0});
	const dragRef = useRef<{startX: number; startY: number; panX: number; panY: number; moved: boolean} | null>(null);
	const [, force] = useReducer((x: number) => x + 1, 0);

	useEffect(() => {
		const el = outerRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const rect = el.getBoundingClientRect();
			const cx = e.clientX - rect.left;
			const cy = e.clientY - rect.top;
			const s = stateRef.current;
			const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom * Math.exp(-e.deltaY * 0.0015)));
			if (next === s.zoom) return;
			const k = next / s.zoom;
			const panX = cx - (cx - s.panX) * k;
			const panY = cy - (cy - s.panY) * k;
			stateRef.current = clampPan({zoom: next, panX, panY}, rect.width, rect.height);
			force();
		};
		el.addEventListener('wheel', onWheel, {passive: false});
		return () => el.removeEventListener('wheel', onWheel);
	}, []);

	function clampPan(s: ZoomState, w: number, h: number): ZoomState {
		if (s.zoom <= 1) return {zoom: 1, panX: 0, panY: 0};
		const mx = ((s.zoom - 1) * w) / 2;
		const my = ((s.zoom - 1) * h) / 2;
		return {
			zoom: s.zoom,
			panX: Math.min(mx, Math.max(-mx, s.panX)),
			panY: Math.min(my, Math.max(-my, s.panY)),
		};
	}

	function reset() {
		stateRef.current = {zoom: 1, panX: 0, panY: 0};
		force();
	}

	const s = stateRef.current;
	return (
		<div
			ref={outerRef}
			style={{width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: s.zoom > 1 ? 'grab' : undefined}}
			onDoubleClick={reset}
			onPointerDown={(e) => {
				if (stateRef.current.zoom <= 1) return;
				(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
				dragRef.current = {startX: e.clientX, startY: e.clientY, panX: stateRef.current.panX, panY: stateRef.current.panY, moved: false};
			}}
			onPointerMove={(e) => {
				const d = dragRef.current;
				if (!d) return;
				const dx = e.clientX - d.startX;
				const dy = e.clientY - d.startY;
				if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
				const el = outerRef.current;
				const w = el?.clientWidth ?? 0;
				const h = el?.clientHeight ?? 0;
				stateRef.current = clampPan(
					{zoom: stateRef.current.zoom, panX: d.panX + dx, panY: d.panY + dy},
					w,
					h,
				);
				force();
			}}
			onPointerUp={() => {
				dragRef.current = null;
			}}
			onClickCapture={(e) => {
				if (dragRef.current?.moved) {
					e.stopPropagation();
					dragRef.current = null;
				}
			}}
			data-flx="voice.voice-participant-tile.media-zoom"
		>
			<div style={{width: '100%', height: '100%', transform: `translate(${s.panX}px, ${s.panY}px) scale(${s.zoom})`, transformOrigin: '0 0'}}>
				{children}
			</div>
		</div>
	);
}
