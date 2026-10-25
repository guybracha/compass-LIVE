import * as THREE from 'three';

// Fixed-size ring-buffer particle pool rendered as a single THREE.Points.
// No allocations per frame; the oldest particle is recycled when full.

export interface EmitOptions {
  pos: THREE.Vector3;
  count: number;
  speed: number;
  spread?: number; // 0 = straight up, 1 = full sphere
  up?: number; // extra upward velocity
  life: [number, number];
  size: [number, number];
  color: THREE.ColorRepresentation;
  colorJitter?: number;
  gravity?: number;
  drag?: number;
  grow?: number; // size multiplier per second
  radius?: number; // spawn radius
  flat?: boolean; // horizontal ring (dust shockwave)
}

const col = new THREE.Color();

export class ParticlePool {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private color: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;
  private grow: Float32Array;
  private head = 0;
  scale = 1;

  constructor(readonly capacity: number, additive: boolean) {
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity).fill(1);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) this.pos[i * 3 + 1] = -1000;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(400.0, aSize * uScale / max(0.1, -mv.z));
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = dot(c, c) * 4.0;
          if (d > 1.0) discard;
          float a = vAlpha * (1.0 - d) * (1.0 - d);
          gl_FragColor = vec4(vColor, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  setViewportScale(px: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = px;
  }

  emit(o: EmitOptions) {
    const n = Math.max(1, Math.round(o.count * this.scale));
    col.set(o.color);
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.capacity;
      const i3 = i * 3;
      const spread = o.spread ?? 1;
      // random direction
      let dx = Math.random() * 2 - 1;
      let dy = o.flat ? 0 : Math.random() * (1 + spread) - spread;
      let dz = Math.random() * 2 - 1;
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len;
      dy /= len;
      dz /= len;
      const sp = o.speed * (0.4 + Math.random() * 0.6);
      const r = (o.radius ?? 0) * Math.random();
      this.pos[i3] = o.pos.x + dx * r;
      this.pos[i3 + 1] = o.pos.y + Math.abs(dy) * r;
      this.pos[i3 + 2] = o.pos.z + dz * r;
      this.vel[i3] = dx * sp;
      this.vel[i3 + 1] = dy * sp + (o.up ?? 0) * (0.5 + Math.random() * 0.5);
      this.vel[i3 + 2] = dz * sp;
      const j = 1 + (Math.random() - 0.5) * (o.colorJitter ?? 0.2);
      this.color[i3] = col.r * j;
      this.color[i3 + 1] = col.g * j;
      this.color[i3 + 2] = col.b * j;
      this.size[i] = o.size[0] + Math.random() * (o.size[1] - o.size[0]);
      this.maxLife[i] = o.life[0] + Math.random() * (o.life[1] - o.life[0]);
      this.life[i] = this.maxLife[i];
      this.alpha[i] = 1;
      this.gravity[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0;
      this.grow[i] = o.grow ?? 0;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.pos[i3 + 1] = -1000;
        continue;
      }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.gravity[i] * dt;
      this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05 && this.gravity[i] > 0) {
        this.pos[i3 + 1] = 0.05;
        this.vel[i3 + 1] *= -0.3;
      }
      this.size[i] *= 1 + this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.5) * (t > 0.9 ? (1 - t) * 10 : 1);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
    for (let i = 0; i < this.capacity; i++) this.pos[i * 3 + 1] = -1000;
  }
}

export const fx = {
  sparks: new ParticlePool(1400, true),
  smoke: new ParticlePool(1100, false),
};
