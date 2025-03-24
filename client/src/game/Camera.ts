export class Camera {
  private x: number;
  private y: number;
  private smoothing: number = 0.1;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  follow(target: { position: { x: number, y: number } }) {
    // 使用线性插值实现平滑相机跟随
    const targetPos = target.position;
    this.x += (targetPos.x - this.x) * this.smoothing;
    this.y += (targetPos.y - this.y) * this.smoothing;
  }
}