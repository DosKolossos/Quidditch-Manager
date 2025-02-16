import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-gamescreen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="game-screen">
      <div class="teams">
        <div class="team home-team">
          Hogwarts Hawks
          <div *ngFor="let player of homePlayers">{{ player.name }} <span class="rating">{{ player.rating }}</span></div>
        </div>
        <div class="score">{{ homeScore }} : {{ awayScore }}</div>
        <div class="team away-team">
          Durmstrang Dragons
          <div *ngFor="let player of awayPlayers"><span class="rating">{{ player.rating }}</span> {{ player.name }}</div>
        </div>
      </div>
      <div class="time">Minute: {{ currentMinute }}</div>
      <div class="event-log">{{ currentEvent }}</div>
    </div>
  `,
  styles: [
    `.game-screen { text-align: center; }
     .teams { display: flex; justify-content: space-between; }
     .home-team {display: flex; text-align: left; flex-direction: column}
     .away-team {display: flex; text-align: right; flex-direction: column}
     .event-log { margin-top: 10px; }
     .rating { margin-left: 5px; }`
  ]
})
export class GamescreenComponent {
  homeScore = 0;
  awayScore = 0;
  currentMinute = 0;
  currentEvent = '';
  homePlayers = [
    { name: 'Oliver Green', rating: 7 },
    { name: 'Luna Johnson', rating: 5 },
    { name: 'Katie Smith', rating: 6 },
    { name: 'Ginny Brown', rating: 5 },
    { name: 'Fred Cooper', rating: 6 },
    { name: 'George Miller', rating: 4 },
    { name: 'Harry Thompson', rating: 6 }
  ];
  awayPlayers = [
    { name: 'Boris Kozlov', rating: 7 },
    { name: 'Anastasia Petrova', rating: 6 },
    { name: 'Natalia Popov', rating: 5 },
    { name: 'Igor Volkov', rating: 4 },
    { name: 'Dimitri Sokolov', rating: 5 },
    { name: 'Irina Romanov', rating: 6 },
    { name: 'Viktor Ivanov', rating: 7 }
  ];

  constructor() {
    this.startGame();
  }

  startGame() {
    const events = ['Ein spektakulärer Pass!', 'Eine großartige Parade!', 'Der Schnatz ist aufgetaucht!', 'Ein Treffer!'];
    const interval = setInterval(() => {
      this.currentMinute++;
      this.currentEvent = events[Math.floor(Math.random() * events.length)];
      if (this.currentMinute >= 90) clearInterval(interval);
    }, 1000);
  }
}