export class InputManager {
  private keys: { [key: string]: boolean } = {};
  private mousePosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    // 监听键盘事件
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));

    // 监听鼠标事件
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent) {
    this.keys[event.key.toLowerCase()] = true;
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.keys[event.key.toLowerCase()] = false;
  }

  private handleMouseMove(event: MouseEvent) {
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
  }

  getDirection() {
    const direction = { x: 0, y: 0 };

    // WASD或方向键控制
    if (this.keys['w'] || this.keys['arrowup']) direction.y -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) direction.y += 1;
    if (this.keys['a'] || this.keys['arrowleft']) direction.x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) direction.x += 1;

    return direction;
  }

  getMousePosition() {
    return this.mousePosition;
  }
}