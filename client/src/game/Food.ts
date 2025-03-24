export class Food {
  private x: number;
  private y: number;
  private _mass: number = 1;
  private color: string;
  private radius: number = 5;

  get mass() {
    return this._mass;
  }

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.color = this.generateRandomColor();
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  get foodMass() {
    return this.mass;
  }

  isColliding(player: { position: { x: number; y: number }; radius: number }) {
    const dx = this.x - player.position.x;
    const dy = this.y - player.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (this.radius + player.radius);
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  private generateRandomColor(): string {
    const hue = Math.random() * 360;
    return `hsl(${hue}, 70%, 50%)`;
  }
}