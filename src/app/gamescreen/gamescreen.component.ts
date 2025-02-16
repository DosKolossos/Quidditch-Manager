import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-gamescreen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="game-screen">
      <div class="teams">
        <div class="team home-team">Hogwarts Hawks</div>
        <div class="score">{{ homeScore }} : {{ awayScore }}</div>
        <div class="team away-team">Durmstrang Dragons</div>
      </div>
      <div class="time">Minute: {{ currentMinute }}</div>
      <div class="event-log" *ngFor="let event of eventLog">{{ event }}</div>
    </div>
  `,
  styles: [
    `.game-screen { text-align: center; } .teams { display: flex; justify-content: space-between; } .event-log { margin-top: 10px; }`
  ]
})
export class GamescreenComponent {
  homeScore = 0;
  awayScore = 0;
  currentMinute = 0;
  eventLog: string[] = [];

  constructor() {
    this.startGame();
  }

  startGame() {
    const interval = setInterval(() => {
      this.currentMinute++;
      this.eventLog.push(`Minute ${this.currentMinute}: Ein spannender Moment!`);
      if (this.currentMinute >= 1000) clearInterval(interval);
    }, 1000);
  }
}