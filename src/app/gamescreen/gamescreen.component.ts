import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';

interface Player {
  name: string;
  position: 'Hüter' | 'Jäger' | 'Treiber' | 'Sucher';
  skills: { [key: string]: number }; // Beispiel: "Schussgenauigkeit", "Halten", "Genauigkeit", etc.
  form: number[];
  todayPerformance: number; // Aktuelle Spielbewertung
  goals?: number;
}

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
  homeSeekerScore = 0;
  awayChaser1Score = 0;
  awayChaser2Score = 0;
  awayChaser3Score = 0;
  awaySeekerScore = 0;
  homeScore = Math.floor(
    this.homeChaser1Score +
    this.homeChaser2Score +
    this.homeChaser3Score +
    this.homeSeekerScore
  );
  awayScore = Math.floor(
    this.awayChaser1Score +
    this.awayChaser2Score +
    this.awayChaser3Score +
    this.awaySeekerScore
  );
  currentMinute = 0;
  // Statt nur einem Text führen wir ein Log (Array) für alle Event-Nachrichten:
  eventLog: string[] = [];
  homePlayers: Player[] = [];
  awayPlayers: Player[] = [];

  constructor(private firestore: Firestore) { }

  ngOnInit(): void {
    this.loadTeams();
    this.startGame();
  }

  loadTeams() {
    const teamsCollection = collection(this.firestore, 'teams');
    collectionData(teamsCollection).subscribe((teams: any) => {
      const homeTeam = teams.find((t: any) => t.teamName === 'Hogwarts Hawks');
      const awayTeam = teams.find((t: any) => t.teamName === 'Durmstrang Dragons');

      // Spieler sortieren und todayPerformance initialisieren (Basiswert 6)
      this.homePlayers = this.sortPlayers(homeTeam.players).map((player: Player) => ({
        ...player,
        todayPerformance: 6
      }));
      this.awayPlayers = this.sortPlayers(awayTeam.players).map((player: Player) => ({
        ...player,
        todayPerformance: 6
      }));
    });
  }

  sortPlayers(players: Player[]): Player[] {
    const positionOrder: { [key in Player['position']]: number } = {
      'Hüter': 1,
      'Jäger': 2,
      'Treiber': 3,
      'Sucher': 4,
    };
    return players.sort((a, b) => positionOrder[a.position] - positionOrder[b.position]);
  }

  startGame() {
    const interval = setInterval(() => {
      this.currentMinute++;
      // Zu Beginn eines jeden Ticks wird NICHT das Log zurückgesetzt!
      // Stattdessen fügen wir neue Events hinzu.

      // === Torschuss-Logik mit Treiberintervention und Performance-Anpassung ===
      if (Math.random() < 0.55) {
        const homeJagers = this.homePlayers.filter(p => p.position === 'Jäger');
        const awayJagers = this.awayPlayers.filter(p => p.position === 'Jäger');
        const homeJagerSkill = this.getTotalJagerSkill(this.homePlayers);
        const awayJagerSkill = this.getTotalJagerSkill(this.awayPlayers);
        const totalSkill = homeJagerSkill + awayJagerSkill;
        const homeProbability = totalSkill > 0 ? homeJagerSkill / totalSkill : 0.5;
  
        const attackingTeam = Math.random() < homeProbability ? 'home' : 'away';
        const attackingPlayer = attackingTeam === 'home'
          ? homeJagers[Math.floor(Math.random() * homeJagers.length)]
          : awayJagers[Math.floor(Math.random() * awayJagers.length)];
  
        const shooterAccuracy = attackingPlayer.skills["Schussgenauigkeit"];
  
        let defenderKeeper: Player | undefined;
        if (attackingTeam === 'home') {
          defenderKeeper = this.awayPlayers.find(p => p.position === 'Hüter');
        } else {
          defenderKeeper = this.homePlayers.find(p => p.position === 'Hüter');
        }
  
        let shotOutcome = false;
        if (defenderKeeper) {
          const keeperAverage = (
            defenderKeeper.skills["Halten"] +
            defenderKeeper.skills["Stellungsspiel"] +
            defenderKeeper.skills["Reaktion"]
          ) / 3;
          const goalChance = shooterAccuracy / (shooterAccuracy + keeperAverage);
          if (Math.random() < goalChance) {
            shotOutcome = true;
          }
        } else {
          shotOutcome = true;
        }
  
        if (shotOutcome) {
          // Prüfe, ob gegnerische Treiber intervenieren können:
          const enemyTreiberCandidates = attackingTeam === 'home'
            ? this.awayPlayers.filter(p => p.position === 'Treiber')
            : this.homePlayers.filter(p => p.position === 'Treiber');
          if (enemyTreiberCandidates.length > 0) {
            const enemyTreiber = enemyTreiberCandidates[Math.floor(Math.random() * enemyTreiberCandidates.length)];
            const offenseSkill = (enemyTreiber.skills["Genauigkeit"] + enemyTreiber.skills["Schlagkraft"]) / 2;
            const targetReaction = attackingPlayer.skills["Reaktion"];
            let interventionChance = offenseSkill / targetReaction;
            if (interventionChance > 1) interventionChance = 1;
            if (Math.random() < interventionChance) {
              // Versuch, den Eingriff mit eigenen Treibern abzuwehren:
              const ownTreiberCandidates = attackingTeam === 'home'
                ? this.homePlayers.filter(p => p.position === 'Treiber')
                : this.awayPlayers.filter(p => p.position === 'Treiber');
              let protectedByDefender = false;
              if (ownTreiberCandidates.length > 0) {
                const defensiveTreiber = ownTreiberCandidates[Math.floor(Math.random() * ownTreiberCandidates.length)];
                const protectionChance = defensiveTreiber.skills["Beschützen"] / 100;
                if (Math.random() < protectionChance) {
                  protectedByDefender = true;
                  defensiveTreiber.todayPerformance += 1; // Schutzbonus
                  this.eventLog.push(`${defensiveTreiber.name} schützt den Schuss!`);
                }
              }
              if (!protectedByDefender) {
                enemyTreiber.todayPerformance += 1; // Erfolgreiche Intervention
                if (attackingTeam === 'home') {
                  this.homeChaser1Score -= 10;
                } else {
                  this.awayChaser1Score -= 10;
                }
                attackingPlayer.goals = Math.max((attackingPlayer.goals || 1) - 1, 0);
                this.eventLog.push(`${enemyTreiber.name} stört den Schuss von ${attackingPlayer.name}!`);
                shotOutcome = false;
              }
            } else {
              enemyTreiber.todayPerformance -= 1; // Fehlgeschlagene Intervention
            }
          }
        }
  
        if (shotOutcome) {
          if (attackingTeam === 'home') {
            this.homeChaser1Score += 10;
          } else {
            this.awayChaser1Score += 10;
          }
          attackingPlayer.goals = (attackingPlayer.goals || 0) + 1;
          attackingPlayer.todayPerformance += 0.5;  // Jäger: +0.5 bei Tor
          if (defenderKeeper) {
            defenderKeeper.todayPerformance -= 0.5; // Hüter: -0.5 bei verfehlter Parade
            const keeperAverage = (
              defenderKeeper.skills["Halten"] +
              defenderKeeper.skills["Stellungsspiel"] +
              defenderKeeper.skills["Reaktion"]
            ) / 3;
            this.eventLog.push(`${defenderKeeper.name} pariert den Schuss von ${attackingPlayer.name} (Durchschnitt: ${keeperAverage.toFixed(1)})!`);
          }
          this.eventLog.push(`${attackingPlayer.name} schießt mit ${shooterAccuracy} und trifft!`);
        } else {
          attackingPlayer.todayPerformance -= 0.5;
          if (defenderKeeper) {
            defenderKeeper.todayPerformance += 1;
            const keeperAverage = (
              defenderKeeper.skills["Halten"] +
              defenderKeeper.skills["Stellungsspiel"] +
              defenderKeeper.skills["Reaktion"]
            ) / 3;
            this.eventLog.push(`${defenderKeeper.name} pariert den Schuss von ${attackingPlayer.name} (Durchschnitt: ${keeperAverage.toFixed(1)})!`);
          } else {
            this.eventLog.push(`${attackingPlayer.name} schießt und verfehlt!`);
          }
        }
        this.updateScore();
      } else {
        // Falls kein Torschuss erfolgt, kann ggf. ein anderes Event gesetzt werden.
      }
  
      // --- Alle 20 Minuten Performance-Abzug für beide Sucher ---
      if (this.currentMinute % 20 === 0) {
        const homeSeeker = this.homePlayers.find(p => p.position === 'Sucher');
        const awaySeeker = this.awayPlayers.find(p => p.position === 'Sucher');
        if (homeSeeker) {
          homeSeeker.todayPerformance -= 0.5;
          this.eventLog.push(`${homeSeeker.name} verliert 0.5 Punkte aufgrund der Zeit.`);
        }
        if (awaySeeker) {
          awaySeeker.todayPerformance -= 0.5;
          this.eventLog.push(`${awaySeeker.name} verliert 0.5 Punkte aufgrund der Zeit.`);
        }
      }
  
      // === Schnatz-Logik mit Treiberintervention ===
      const snitchChance = Math.min(this.currentMinute * 0.005, 0.30);
      if (Math.random() < snitchChance) {
        const bonus = 3 - (0.5 * Math.floor(this.currentMinute / 20));
  
        const homeSeeker = this.homePlayers.find(p => p.position === 'Sucher');
        const awaySeeker = this.awayPlayers.find(p => p.position === 'Sucher');
  
        const homeSeekerSkill = homeSeeker
          ? Object.values(homeSeeker.skills).reduce((sum: number, value: number) => sum + value, 0)
          : 0;
        const awaySeekerSkill = awaySeeker
          ? Object.values(awaySeeker.skills).reduce((sum: number, value: number) => sum + value, 0)
          : 0;
        const totalSeekerSkill = homeSeekerSkill + awaySeekerSkill;
        const homeProbability = totalSeekerSkill > 0 ? homeSeekerSkill / totalSeekerSkill : 0.5;
        const catchingTeam = Math.random() < homeProbability ? 'home' : 'away';
  
        // Treiberintervention beim Schnatzfang:
        const enemyTreiberCandidates = catchingTeam === 'home'
          ? this.awayPlayers.filter(p => p.position === 'Treiber')
          : this.homePlayers.filter(p => p.position === 'Treiber');
        let interventionOccurred = false;
        if (enemyTreiberCandidates.length > 0) {
          const enemyTreiber = enemyTreiberCandidates[Math.floor(Math.random() * enemyTreiberCandidates.length)];
          const offenseSkill = (enemyTreiber.skills["Genauigkeit"] + enemyTreiber.skills["Schlagkraft"]) / 2;
          const seekerReaction = catchingTeam === 'home'
            ? (homeSeeker ? homeSeeker.skills["Reaktion"] : 50)
            : (awaySeeker ? awaySeeker.skills["Reaktion"] : 50);
          let interventionChance = offenseSkill / seekerReaction;
          if (interventionChance > 1) interventionChance = 1;
          if (Math.random() < interventionChance) {
            const ownTreiberCandidates = catchingTeam === 'home'
              ? this.homePlayers.filter(p => p.position === 'Treiber')
              : this.awayPlayers.filter(p => p.position === 'Treiber');
            let protectedByDefender = false;
            if (ownTreiberCandidates.length > 0) {
              const defensiveTreiber = ownTreiberCandidates[Math.floor(Math.random() * ownTreiberCandidates.length)];
              const protectionChance = defensiveTreiber.skills["Beschützen"] / 100;
              if (Math.random() < protectionChance) {
                protectedByDefender = true;
                defensiveTreiber.todayPerformance += 2; // Schutzaktion: +2
                this.eventLog.push(`${defensiveTreiber.name} schützt den Sucher!`);
              }
            }
            if (!protectedByDefender) {
              enemyTreiber.todayPerformance += 2; // Erfolgreiche Intervention: +2
              this.eventLog.push(`${enemyTreiber.name} stört den Schnatzfang!`);
              interventionOccurred = true;
            }
          } else {
            enemyTreiber.todayPerformance -= 1; // Fehlgeschlagene Intervention: -1
          }
        }
  
        if (!interventionOccurred) {
          // Schnatzfang wird gewertet – das Spiel endet
          if (catchingTeam === 'home') {
            this.homeSeekerScore += 150;
            if (homeSeeker) {
              homeSeeker.todayPerformance += bonus;
              this.eventLog.push(`${homeSeeker.name} fängt den Schnatz!`);
            } else {
              this.eventLog.push(`Hogwarts Hawks fangen den Schnatz!`);
            }
            if (awaySeeker) {
              awaySeeker.todayPerformance -= 1;
            }
          } else {
            this.awaySeekerScore += 150;
            if (awaySeeker) {
              awaySeeker.todayPerformance += bonus;
              this.eventLog.push(`${awaySeeker.name} fängt den Schnatz!`);
            } else {
              this.eventLog.push(`Durmstrang Dragons fangen den Schnatz!`);
            }
            if (homeSeeker) {
              homeSeeker.todayPerformance -= 1;
            }
          }
          this.updateScore();
          clearInterval(interval);
          return; // Spielende, da der Schnatz gefangen wurde
        }
      }
  
      if (this.currentMinute >= 90) {
        clearInterval(interval);
      }
    }, 2000);
  }
  
  /**
   * Berechnet den addierten Skillwert der Jäger eines Teams.
   */
  private getTotalJagerSkill(players: Player[]): number {
    return players
      .filter(p => p.position === 'Jäger')
      .reduce((teamSum, player) => {
        const playerSum = Object.values(player.skills).reduce((sum, value) => sum + value, 0);
        return teamSum + playerSum;
      }, 0);
  }
  
  /**
   * Aktualisiert den Gesamtscore basierend auf den Einzelwerten.
   */
  updateScore() {
    this.homeScore = Math.floor(
      this.homeChaser1Score +
      this.homeChaser2Score +
      this.homeChaser3Score +
      this.homeSeekerScore
    );
    this.awayScore = Math.floor(
      this.awayChaser1Score +
      this.awayChaser2Score +
      this.awayChaser3Score +
      this.awaySeekerScore
    );
  }
}
