import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-gamescreen',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './gamescreen.component.scss',
  templateUrl: './gamescreen.component.html',
})
export class GamescreenComponent {
  homeChaser1Score = 0;
  homeChaser2Score = 0;
  homeChaser3Score = 0;
  awayChaser1Score = 0;
  awayChaser2Score = 0;
  awayChaser3Score = 0;
  homeScore = Math.floor(this.homeChaser1Score + this.homeChaser2Score + this.homeChaser3Score);
  awayScore = Math.floor(this.awayChaser1Score + this.awayChaser2Score + this.awayChaser3Score);
  currentMinute = 0;
  currentEvent = '';
  homePlayers: any[] = [];
  awayPlayers: any[] = [];

  constructor(private firestore: Firestore) {}

  ngOnInit(): void {
    this.loadTeams();
    this.startGame();
  }

  loadTeams() {
    const teamsCollection = collection(this.firestore, 'teams');
    collectionData(teamsCollection).subscribe((teams: any) => {
      this.homePlayers = teams.find((t: any) => t.teamName === 'Hogwarts Hawks').players;
      this.awayPlayers = teams.find((t: any) => t.teamName === 'Durmstrang Dragons').players;
    });
  }

  startGame() {
    const interval = setInterval(() => {
      this.currentMinute++;

  // Zufallsentscheidung für einen Torschuss (1/4 Chance)
  if (Math.random() < 0.55) {
    const homeJagers = this.homePlayers.filter(p => p.position === 'Jäger');
    const awayJagers = this.awayPlayers.filter(p => p.position === 'Jäger');
    const attackingTeam = Math.random() < 0.5 ? 'home' : 'away';
    const attackingPlayer = attackingTeam === 'home'
      ? homeJagers[Math.floor(Math.random() * homeJagers.length)]
      : awayJagers[Math.floor(Math.random() * awayJagers.length)];

    // Tor erzielen
    if (attackingTeam === 'home') {
      this.homeScore += 10;
    } else {
      this.awayScore += 10;
    }

    // Tor dem Spieler zuweisen
    attackingPlayer.goals = (attackingPlayer.goals || 0) + 1;

    this.currentEvent = `${attackingPlayer.name} hat ein Tor erzielt!`;
  } else {
    this.currentEvent = '';
  }

  if (this.currentMinute >= 90) clearInterval(interval);
}, 1000);
  }
}