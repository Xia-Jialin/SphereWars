export class Player {
  public x: number;
  public y: number;
  private _mass: number;
  public color: string;
  public readonly id: string;
  public readonly name: string;
  private speed: number = 5;
  private velocity: { x: number; y: number } = { x: 0, y: 0 };
  private splitCooldown: number = 0;

  constructor(id: string, name: string, x: number, y: number, mass: number) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this._mass = mass;
    this.color = this.generateRandomColor();
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  get radius() {
    return Math.sqrt(this.mass * 100);
  }

  move(dirX: number, dirY: number, deltaTime: number) {
    // 根据质量调整速度
    const speedFactor = Math.max(0.5, 2 / Math.sqrt(this.mass));
    const moveSpeed = this.speed * speedFactor;

    // 标准化方向向量
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    if (length > 0) {
      dirX /= length;
      dirY /= length;
    }

    // 更新速度和位置
    this.velocity.x = dirX * moveSpeed;
    this.velocity.y = dirY * moveSpeed;
    this.x += this.velocity.x * (deltaTime / 16);
    this.y += this.velocity.y * (deltaTime / 16);

    // 更新分裂冷却时间
    if (this.splitCooldown > 0) {
      this.splitCooldown = Math.max(0, this.splitCooldown - deltaTime);
    }

    // 限制在地图范围内
    const mapSize = 10000;
    const radius = this.radius;
    this.x = Math.max(radius, Math.min(mapSize - radius, this.x));
    this.y = Math.max(radius, Math.min(mapSize - radius, this.y));
  }

  render(ctx: CanvasRenderingContext2D) {
    // 绘制球体
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // 绘制边框
    ctx.strokeStyle = this.darkenColor(this.color);
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制玩家名字
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.name || 'Player', this.x, this.y);
  }

  private generateRandomColor(): string {
    const hue = Math.random() * 360;
    return `hsl(${hue}, 70%, 70%)`;
  }

  private darkenColor(color: string): string {
    const hsl = color.match(/\d+/g)!;
    return `hsl(${hsl[0]}, ${hsl[1]}%, ${Math.max(0, Number(hsl[2]) - 20)}%)`;
  }

  split(): Player | null {
    if (this.mass < 20 || this.splitCooldown > 0) return null;

    // 计算新球体的质量和速度
    const newMass = this.mass / 2;
    this.mass = newMass;

    // 创建新的分裂球体
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    const splitDistance = this.radius * 2;
    const newX = this.x + Math.cos(angle) * splitDistance;
    const newY = this.y + Math.sin(angle) * splitDistance;

    const newPlayer = new Player(this.id, this.name, newX, newY, newMass);
    newPlayer.velocity.x = this.velocity.x * 2;
    newPlayer.velocity.y = this.velocity.y * 2;
    newPlayer.splitCooldown = 5000; // 5秒冷却时间

    this.splitCooldown = 5000;
    return newPlayer;
  }

  canMerge(other: Player): boolean {
    if (this.id !== other.id) return false;
    if (this.splitCooldown > 0 || other.splitCooldown > 0) return false;

    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (this.radius + other.radius);
  }

  merge(other: Player) {
    this.mass += other.mass;
  }

  get mass(): number {
    return this._mass;
  }

  get velocityX(): number {
    return this.velocity.x;
  }

  get velocityY(): number {
    return this.velocity.y;
  }

  set mass(value: number) {
    this._mass = value;
  }
}