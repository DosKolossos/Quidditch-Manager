import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import summaryTemplates from '../../assets/summaryTemplates.json';
import eventTemplates from '../../assets/eventTemplates.json';
import { filter, take } from 'rxjs/operators';


interface Player {
  name: string;
  position: 'Hüter' | 'Jäger' | 'Treiber' | 'Sucher';
  skills: { [key: string]: number }; // z. B. "Schussgenauigkeit", "Halten", etc.
  form: number[];
  todayPerformance: number; // Aktuelle Spielbewertung
  goals?: number;
  gender: string;
}

interface Team {
  name: string;
  prefix: string[];
  players: Player[];
}

interface EventTemplates {
  chaser: {
    intro: string[];
    parryAttempt: string[];
    parrySuccess: string[];
    missingShot: string[]
  };
  treiber: {  // statt "driver"
    interventionSuccess: string[];
    treiberProtection: string[];
    noIntervention: string[];
  };
  snitch: {
    intro: string[];
    opponentWarning: string[];
    clatter: string[];
    interventionAttempt: string[];
    interventionSuccess: string[];
    intervention: string[];
    driverProtection: string[];
    catch: {
      win: string[];
      draw: string[];
      loss: string[];
    };
  };
}



@Component({
  selector: 'app-gamescreen',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './gamescreen.component.scss',
  templateUrl: './gamescreen.component.html',
})
export class GamescreenComponent {
  private homeTeamData: Team | null = null;
  private awayTeamData: Team | null = null;

  homeChaser1Score = 0;
  homeChaser2Score = 0;
  homeChaser3Score = 0;
  homeSeekerScore = 0;
  awayChaser1Score = 0;
  awayChaser2Score = 0;
  awayChaser3Score = 0;
  awaySeekerScore = 0;
  // Gesamtscores werden ausschließlich aus Chaser- und Seeker-Punkten berechnet:
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
  // Wir verwenden ein Eventlog und ein aktuelles Segment für die Anzeige:
  eventLog: string[] = [];
  currentEventSegment: string = "";
  textTempo: number = 30;
  gameTempo: number = 20;
  summaryLog: string = "";
  // Flag, das anzeigt, ob gerade eine Eventkette angezeigt wird:
  private isEventChainActive: boolean = false;
  // Hier speichern wir den Interval-Handle, damit wir ihn später stoppen können:
  private gameInterval: number = 0;

  homePlayers: Player[] = [];
  awayPlayers: Player[] = [];

  constructor(private firestore: Firestore) { }

  ngOnInit(): void {
    this.loadTeams();
  }

    // Startet den Game-Loop
    public startGame(): void {
      this.gameInterval = window.setInterval(() => {
        this.mainGameLoop();
      }, this.gameTempo);
    }

  // 1. Laden und Sortieren der Teams sowie Initialisierung von todayPerformance
  private loadTeams(): void {
    const teamsCollection = collection(this.firestore, 'teams');
    collectionData(teamsCollection).pipe(
      filter((teams: any[]) => teams && teams.length >= 2),
      take(1) // Nimm nur die erste vollständige Emission
    ).subscribe((teams: any[]) => {
      console.log("Geladene Teams:", teams);
      const homeTeam = teams.find((t: any) => t.name === 'Hogwarts Hawks');
      const awayTeam = teams.find((t: any) => t.name === 'Durmstrang Dragons');
      
      if (!homeTeam) {
        console.error("Team 'Hogwarts Hawks' nicht gefunden!");
        return;
      }
      if (!awayTeam) {
        console.error("Team 'Durmstrang Dragons' nicht gefunden!");
        return;
      }
      
      this.homeTeamData = {
        name: homeTeam.name,
        prefix: homeTeam.prefix || "",
        players: homeTeam.players
      };
      this.awayTeamData = {
        name: awayTeam.name,
        prefix: awayTeam.prefix || "",
        players: awayTeam.players
      };
  
      this.homePlayers = this.sortPlayers(homeTeam.players).map((player: Player) => ({
        ...player,
        todayPerformance: 6,
      }));
      this.awayPlayers = this.sortPlayers(awayTeam.players).map((player: Player) => ({
        ...player,
        todayPerformance: 6,
      }));
  
      // Starte den Game-Loop erst, wenn beide Teams geladen sind.
      this.startGame();
    });
  }
  
  


  // 2. Spieler nach Position sortieren
  private sortPlayers(players: Player[]): Player[] {
    const positionOrder: { [key in Player['position']]: number } = {
      'Hüter': 1,
      'Jäger': 2,
      'Treiber': 3,
      'Sucher': 4,
    };
    return players.sort((a, b) => positionOrder[a.position] - positionOrder[b.position]);
  }

  // 3. Entscheide, welches Team angreift, basierend auf den Jäger-Skills
  private decideAttackingTeam(): { attackingTeam: 'home' | 'away'; attackingPlayer: Player } {
    const homeJagers = this.homePlayers.filter((p) => p.position === 'Jäger');
    const awayJagers = this.awayPlayers.filter((p) => p.position === 'Jäger');
    
    if (homeJagers.length === 0) {
      console.warn("Heimteam hat keine Jäger, verwende Fallback-Spieler.");
    }
    if (awayJagers.length === 0) {
      console.warn("Auswärtsteam hat keine Jäger, verwende Fallback-Spieler.");
    }
    
    const finalHomeCandidates = homeJagers.length > 0 ? homeJagers : this.homePlayers;
    const finalAwayCandidates = awayJagers.length > 0 ? awayJagers : this.awayPlayers;
    
    if(finalHomeCandidates.length === 0 || finalAwayCandidates.length === 0) {
      throw new Error("Mindestens ein Team hat gar keine Spieler!");
    }
    
    const homeJagerSkill = this.getTotalJagerSkill(finalHomeCandidates);
    const awayJagerSkill = this.getTotalJagerSkill(finalAwayCandidates);
    const totalSkill = homeJagerSkill + awayJagerSkill;
    const homeProbability = totalSkill > 0 ? homeJagerSkill / totalSkill : 0.5;
    const attackingTeam: 'home' | 'away' = Math.random() < homeProbability ? 'home' : 'away';
    const attackingPlayer =
      attackingTeam === 'home'
        ? finalHomeCandidates[Math.floor(Math.random() * finalHomeCandidates.length)]
        : finalAwayCandidates[Math.floor(Math.random() * finalAwayCandidates.length)];
    return { attackingTeam, attackingPlayer };
  }
  
  
  

  // 4. Ermittle den gegnerischen Torwart (Hüter) anhand des angreifenden Teams
  private getDefenderKeeper(attackingTeam: 'home' | 'away'): Player | undefined {
    return attackingTeam === 'home'
      ? this.awayPlayers.find((p) => p.position === 'Hüter')
      : this.homePlayers.find((p) => p.position === 'Hüter');
  }

  // 5. Berechne, ob der Schuss erfolgreich ist, und liefere den durchschnittlichen Hüterskill
  private calculateShotOutcome(
    shooterAccuracy: number,
    defenderKeeper?: Player
  ): { shotOutcome: boolean; keeperAverage: number } {
    let shotOutcome = false;
    let keeperAverage = 0;
    if (defenderKeeper) {
      keeperAverage =
        (defenderKeeper.skills["Halten"] +
          defenderKeeper.skills["Stellungsspiel"] +
          defenderKeeper.skills["Reaktion"]) /
        3;
      const goalChance = shooterAccuracy / (shooterAccuracy + keeperAverage);
      shotOutcome = Math.random() < goalChance;
    } else {
      shotOutcome = true;
    }
    return { shotOutcome, keeperAverage };
  }

  // 6. Bearbeite gegnerische Treiberintervention bei einem Schuss und füge Eventtexte hinzu.
  // Gibt true zurück, wenn die Intervention den Schuss verhindert.
  private processTreiberIntervention(
    attackingPlayer: Player,
    attackingTeam: 'home' | 'away',
    eventChain: string[]
  ): boolean {
    const enemyTreiberCandidates =
      attackingTeam === 'home'
        ? this.awayPlayers.filter((p) => p.position === 'Treiber')
        : this.homePlayers.filter((p) => p.position === 'Treiber');
    if (enemyTreiberCandidates.length > 0) {
      const enemyTreiber =
        enemyTreiberCandidates[Math.floor(Math.random() * enemyTreiberCandidates.length)];
      const offenseSkill =
        (enemyTreiber.skills["Genauigkeit"] + enemyTreiber.skills["Schlagkraft"]) / 2;
      const targetReaction = attackingPlayer.skills["Reaktion"];
      let interventionChance = offenseSkill / targetReaction;
      if (interventionChance > 1) interventionChance = 1;
      if (Math.random() < interventionChance) {
        // Verwende dynamische Vorlage für erfolgreiche Intervention durch den gegnerischen Treiber
        const interventionMsg = this.getRandomTemplate("treiber", "interventionSuccess", {
          enemyTreiber: enemyTreiber.name,
          attacker: attackingPlayer.name
        });
        eventChain.push(interventionMsg);
        
        // Versuch, den Eingriff mit einem eigenen Treiber abzuwehren:
        const ownTreiberCandidates =
          attackingTeam === 'home'
            ? this.homePlayers.filter((p) => p.position === 'Treiber')
            : this.awayPlayers.filter((p) => p.position === 'Treiber');
        let protectedByDefender = false;
        if (ownTreiberCandidates.length > 0) {
          const defensiveTreiber =
            ownTreiberCandidates[Math.floor(Math.random() * ownTreiberCandidates.length)];
          const protectionChance = defensiveTreiber.skills["Beschützen"] / 100;
          if (Math.random() < protectionChance) {
            protectedByDefender = true;
            // Erhöhe die Performance des defensiven Treibers (aber nicht über 10)
            defensiveTreiber.todayPerformance = Math.min(10, defensiveTreiber.todayPerformance + 1);
            // Bestimme das Pronomen für den schützenden Treiber
            const pronoun = defensiveTreiber.gender === 'female' ? "ihr" : "sein";
            const protectionMsg = this.getRandomTemplate("treiber", "treiberProtection", {
              ownTreiber: defensiveTreiber.name,
              attacker: attackingPlayer.name,
              pronoun: pronoun
            });
            eventChain.push(protectionMsg);
          }
        }
        if (protectedByDefender) {
          // Bei erfolgreicher Abwehr bekommt der offensive Treiber einen kleinen Abzug
          enemyTreiber.todayPerformance = Math.max(0, enemyTreiber.todayPerformance - 0.5);
          return false;
        } else {
          enemyTreiber.todayPerformance = Math.min(10, enemyTreiber.todayPerformance + 1);
          const interventionSuccessText = this.getRandomTemplate("treiber", "interventionSuccess", {
            enemyTreiber: enemyTreiber.name,
            attacker: attackingPlayer.name
          });
          eventChain.push(interventionSuccessText);
          return true;
          
        }
      } else {
        enemyTreiber.todayPerformance = Math.max(0, enemyTreiber.todayPerformance - 1);
      }
    }
    return false;
  }
  


  // 7. Prozessiere einen Chaser-Schuss (Torschuss) komplett, sammle pending Updates und zeige die Eventkette segmentweise.
  private processChaserShot(): void {
    const eventChain: string[] = [];
    // Pending Updates
    let pendingHomeChaserDelta = 0;
    let pendingAwayChaserDelta = 0;
    let pendingAttackingPlayerDelta = 0;
    let pendingDefenderDelta = 0;
    let pendingGoalIncrement = 0;
    let finalShotOutcome = false;
    let defenderKeeper: Player | undefined;
    let keeperAverage = 0;
  
    const { attackingTeam, attackingPlayer } = this.decideAttackingTeam();
    // Nutze ein dynamisches Template für die Einleitung – falls attackingPlayer.name fehlt, benutze einen Fallback
    const introText = this.getRandomTemplate("chaser", "intro", { attacker: attackingPlayer.name || "Unbekannter Spieler" });
    eventChain.push(introText);
  
    const shooterAccuracy = attackingPlayer.skills["Schussgenauigkeit"];
    defenderKeeper = this.getDefenderKeeper(attackingTeam);
    const shotResult = this.calculateShotOutcome(shooterAccuracy, defenderKeeper);
    finalShotOutcome = shotResult.shotOutcome;
    keeperAverage = shotResult.keeperAverage;
  
    if (finalShotOutcome) {
      // Prüfe, ob gegnerische Treiber vorhanden sind:
      const enemyTreiberCandidates =
        attackingTeam === 'home'
          ? this.awayPlayers.filter((p) => p.position === 'Treiber')
          : this.homePlayers.filter((p) => p.position === 'Treiber');
      if (enemyTreiberCandidates.length === 0) {
        // Verwende ein Template, wenn kein gegnerischer Treiber zur Intervention bereitsteht
        eventChain.push(this.getRandomTemplate("treiber", "noIntervention", { attacker: attackingPlayer.name }));
      } else {
        const interventionOccurred = this.processTreiberIntervention(attackingPlayer, attackingTeam, eventChain);
        if (interventionOccurred) {
          finalShotOutcome = false;
        }
      }
    }
  
    if (finalShotOutcome) {
      if (attackingTeam === 'home') {
        pendingHomeChaserDelta += 10;
      } else {
        pendingAwayChaserDelta += 10;
      }
      pendingAttackingPlayerDelta += 1; // Jäger erhält +1
      pendingGoalIncrement = 1;
      if (defenderKeeper && defenderKeeper.name) {
        pendingDefenderDelta = -0.5;
        const pronoun = defenderKeeper.gender === 'female' ? "ihr" : "sein";
        const parryAttemptText = this.getRandomTemplate("chaser", "parryAttempt", {
          defender: defenderKeeper.name,
          pronoun: pronoun
        });
        eventChain.push(parryAttemptText);
      }
      eventChain.push("Tor!");
    } else {
      pendingAttackingPlayerDelta -= 0.5;
      if (defenderKeeper && defenderKeeper.name) {
        pendingDefenderDelta += 1;
        const pronoun = defenderKeeper.gender === 'female' ? "ihr" : "sein";
        const parrySuccessText = this.getRandomTemplate("chaser", "parrySuccess", {
          defender: defenderKeeper.name,
          pronoun: pronoun
        });
        eventChain.push(parrySuccessText);
      } else {
        eventChain.push(`${attackingPlayer.name} schießt und verfehlt!`);
      }
      if (defenderKeeper && defenderKeeper.name) {
        const pronoun = defenderKeeper.gender === 'female' ? "ihr" : "sein";
        const missingShot = this.getRandomTemplate("chaser", "missingShot", {
          defender: defenderKeeper.name,
          pronoun: pronoun
        });
        eventChain.push(missingShot);
      } else {
        const missingShot = this.getRandomTemplate("chaser", "missingShot", {
          defender: "Kein Verteidiger",
          pronoun: ""
        });
        eventChain.push(missingShot);
      }
    }
  
    // Zum Debuggen: Gib die gesamte EventChain in der Konsole aus
    console.log("EventChain:", eventChain);
  
    // Zeige die Eventkette segmentweise an und führe dann die pending Updates im Callback aus.
    this.displayEventChain(eventChain, () => {
      if (attackingTeam === 'home') {
        this.homeChaser1Score += pendingHomeChaserDelta;
      } else {
        this.awayChaser1Score += pendingAwayChaserDelta;
      }
      attackingPlayer.todayPerformance = Math.min(10, attackingPlayer.todayPerformance + pendingAttackingPlayerDelta);
      if (defenderKeeper) {
        defenderKeeper.todayPerformance = Math.min(10, defenderKeeper.todayPerformance + pendingDefenderDelta);
      }
      if (pendingGoalIncrement > 0) {
        attackingPlayer.goals = (attackingPlayer.goals || 0) + pendingGoalIncrement;
      }
      this.updateScore();
    });
  }
  

  
  

  // 8. Verarbeite alle 20 Minuten den Performance-Abzug für beide Sucher
  private processTimePenalty(): void {
    if (this.currentMinute % 20 === 0) {
      const homeSeeker = this.homePlayers.find((p) => p.position === 'Sucher');
      const awaySeeker = this.awayPlayers.find((p) => p.position === 'Sucher');
      if (homeSeeker) {
        homeSeeker.todayPerformance = Math.min(10, homeSeeker.todayPerformance - 0.5);
        this.eventLog.push(`${homeSeeker.name} verliert 0.5 Punkte aufgrund der Zeit.`);
      }
      if (awaySeeker) {
        awaySeeker.todayPerformance = Math.min(10, awaySeeker.todayPerformance - 0.5);
        this.eventLog.push(`${awaySeeker.name} verliert 0.5 Punkte aufgrund der Zeit.`);
      }
    }
  }

  private finalSnitchCatcherTeam: 'home' | 'away' | null = null;
  private finalSnitchCatcherName: string = "";

  // 9. Prozessiere den Schnatz (Sucher) mit Treiberintervention. Das Schnatzevent soll Vorrang haben.
  // Der Timer wird gestoppt, während die Eventkette angezeigt wird.
  // Gibt true zurück, wenn der Schnatz gefangen wurde und das Spiel beendet wird.
  private processSnitchEvent(): boolean {
    const snitchChance = Math.min(this.currentMinute * 0.002, 0.30);
    if (Math.random() < snitchChance) {
      const eventChain: string[] = [];
      // Pending Updates für den Schnatzfang
      let pendingHomeSeekerDelta = 0;
      let pendingAwaySeekerDelta = 0;
      let snitchCaught = false;
  
      // Schritt 1: Einleitung (Template dynamisch laden)
      eventChain.push(this.getRandomTemplate("snitch", "intro", {}));
  
      const bonus = 3 - 0.5 * Math.floor(this.currentMinute / 20);
      const homeSeeker = this.homePlayers.find((p) => p.position === 'Sucher');
      const awaySeeker = this.awayPlayers.find((p) => p.position === 'Sucher');
  
      // Berechne die kombinierten Skills der Sucher
      const homeSeekerSkill = homeSeeker
        ? Object.values(homeSeeker.skills).reduce((sum: number, v: number) => sum + v, 0)
        : 0;
      const awaySeekerSkill = awaySeeker
        ? Object.values(awaySeeker.skills).reduce((sum: number, v: number) => sum + v, 0)
        : 0;
      const totalSeekerSkill = homeSeekerSkill + awaySeekerSkill;
      const homeProbability = totalSeekerSkill > 0 ? homeSeekerSkill / totalSeekerSkill : 0.5;
  
      // Wähle hier einen Sucher als "festen" Kandidaten anhand des Catching-Teams:
      const catchingTeam: 'home' | 'away' = Math.random() < homeProbability ? 'home' : 'away';
      const selectedSeeker = catchingTeam === 'home' ? homeSeeker : awaySeeker;
      // Falls kein Sucher vorhanden ist, verwende einen Fallback-Namen:
      const selectedSeekerName = selectedSeeker ? selectedSeeker.name : "Sucher";
  
      // Schritt 2: Hinweis, welcher gegnerische Sucher nicht mithalten kann – übergeben kannst du z. B. den Namen
      if (catchingTeam === 'home') {
        eventChain.push(this.getRandomTemplate("snitch", "opponentWarning", { opponent: "Durmstrang", opponentSucher: awaySeeker ? awaySeeker.name : "Sucher" }));
      } else {
        eventChain.push(this.getRandomTemplate("snitch", "opponentWarning", { opponent: "Hogwarts", opponentSucher: homeSeeker ? homeSeeker.name : "Sucher" }));
      }
  
      // Schritt 3: Ein Klatscher kreuzt den Weg des Suchers
      eventChain.push(this.getRandomTemplate("snitch", "clatter", {}));
  
      // Schritt 4: Versuch einer Intervention durch einen gegnerischen Treiber
      const enemyTreiberCandidates = catchingTeam === 'home'
        ? this.awayPlayers.filter((p) => p.position === 'Treiber')
        : this.homePlayers.filter((p) => p.position === 'Treiber');
      let interventionOccurred = false;
      if (enemyTreiberCandidates.length > 0) {
        const enemyTreiber = enemyTreiberCandidates[Math.floor(Math.random() * enemyTreiberCandidates.length)];
        const offenseSkill = (enemyTreiber.skills["Genauigkeit"] + enemyTreiber.skills["Schlagkraft"]) / 2;
        const seekerReaction = selectedSeeker ? selectedSeeker.skills["Reaktion"] : 50;
        let interventionChance = offenseSkill / seekerReaction;
        if (interventionChance > 1) interventionChance = 1;
        if (Math.random() < interventionChance) {
          eventChain.push(this.getRandomTemplate("snitch", "interventionAttempt", { enemyDriver: enemyTreiber.name }));
          // Versuch, den Eingriff mit einem eigenen Treiber abzuwehren:
          const ownTreiberCandidates = catchingTeam === 'home'
            ? this.homePlayers.filter((p) => p.position === 'Treiber')
            : this.awayPlayers.filter((p) => p.position === 'Treiber');
          let protectedByDefender = false;
          if (ownTreiberCandidates.length > 0) {
            const defensiveTreiber = ownTreiberCandidates[Math.floor(Math.random() * ownTreiberCandidates.length)];
            const protectionChance = defensiveTreiber.skills["Beschützen"] / 100;
            if (Math.random() < protectionChance) {
              protectedByDefender = true;
              defensiveTreiber.todayPerformance = Math.min(10, defensiveTreiber.todayPerformance + 2);
              eventChain.push(this.getRandomTemplate("snitch", "interventionSuccess", { ownDriver: defensiveTreiber.name }));
            }
          }
          if (!protectedByDefender) {
            enemyTreiber.todayPerformance = Math.min(10, enemyTreiber.todayPerformance + 2);
            eventChain.push(this.getRandomTemplate("snitch", "interventionFail", { enemyDriver: enemyTreiber.name }));
            interventionOccurred = true;
          }
        } else {
          enemyTreiber.todayPerformance = Math.max(0, enemyTreiber.todayPerformance - 1);
        }
      }
  
      // Schritt 5: Abschluss – prüfe, ob eine Intervention stattgefunden hat.
      if (interventionOccurred) {
        snitchCaught = false;
        // Füge einen dynamischen Text hinzu, der signalisiert, dass der Schnatzfang verhindert wurde.
        eventChain.push(this.getRandomTemplate("snitch", "intervention", {}));
      } else {
        snitchCaught = true;
        if (catchingTeam === 'home') {
          pendingHomeSeekerDelta = bonus;
          this.finalSnitchCatcherTeam = 'home';
          this.finalSnitchCatcherName = selectedSeekerName;
          eventChain.push(this.getRandomTemplate("snitch", "catch", { snitchCatcher: selectedSeekerName }));
        } else {
          pendingAwaySeekerDelta = bonus;
          this.finalSnitchCatcherTeam = 'away';
          this.finalSnitchCatcherName = selectedSeekerName;
          eventChain.push(this.getRandomTemplate("snitch", "catch", { snitchCatcher: selectedSeekerName }));
        }
      }
  
      // Debug: Ausgabe der kompletten EventChain in der Konsole
      console.log("Snitch event chain:", eventChain);
  
      // Zeige die Eventkette segmentweise an und führe dann im Callback die Updates aus.
      this.displayEventChain(eventChain, () => {
        if (catchingTeam === 'home') {
          if (homeSeeker) {
            homeSeeker.todayPerformance = Math.min(10, homeSeeker.todayPerformance + pendingHomeSeekerDelta);
          }
          if (awaySeeker) {
            awaySeeker.todayPerformance = Math.min(10, awaySeeker.todayPerformance + pendingAwaySeekerDelta);
          }
        } else {
          if (awaySeeker) {
            awaySeeker.todayPerformance = Math.min(10, awaySeeker.todayPerformance + pendingAwaySeekerDelta);
          }
          if (homeSeeker) {
            homeSeeker.todayPerformance = Math.min(10, homeSeeker.todayPerformance + pendingHomeSeekerDelta);
          }
        }
        if (snitchCaught) {
          if (catchingTeam === 'home') {
            this.homeSeekerScore += 150;
          } else {
            this.awaySeekerScore += 150;
          }
        }
        this.updateScore();
        if (snitchCaught) {
          clearInterval(this.gameInterval);
          this.displayGameSummary();
        }
      });
  
      return true;
    }
    return false;
  }
  
  




  // 10. Aktualisiere den Teamscore
  private updateTeamScore(): void {
    this.homeScore = Math.max(0, Math.floor(
      this.homeChaser1Score +
      this.homeChaser2Score +
      this.homeChaser3Score +
      this.homeSeekerScore
    ));
    this.awayScore = Math.max(0, Math.floor(
      this.awayChaser1Score +
      this.awayChaser2Score +
      this.awayChaser3Score +
      this.awaySeekerScore
    ));
  }

  // Neue Methode: Zeige die Spielzusammenfassung an.
  private displayGameSummary(): void {
    let summary = "";
    let mvpMessage = "";
    let winningTeam: 'home' | 'away' | 'draw';

    // Bestimme den Gewinner anhand der Punktzahlen:
    if (this.homeScore > this.awayScore) {
      winningTeam = 'home';
    } else if (this.homeScore < this.awayScore) {
      winningTeam = 'away';
    } else {
      winningTeam = 'draw';
    }

    // Erzeuge Teamnamen in Akkusativ (für Schlusssatz) und Nominativ (für MVP):
    // Wir gehen davon aus, dass in den Teamdaten prefix als Array vorliegt, z. B. ["die", "den"]
    const homeTeamAccusative = this.homeTeamData
      ? (this.homeTeamData.prefix && this.homeTeamData.prefix[1] ? this.homeTeamData.prefix[1] + " " : "") + this.homeTeamData.name
      : "Hogwarts Hawks";
    const awayTeamAccusative = this.awayTeamData
      ? (this.awayTeamData.prefix && this.awayTeamData.prefix[1] ? this.awayTeamData.prefix[1] + " " : "") + this.awayTeamData.name
      : "Durmstrang Dragons";

    const homeTeamNominative = this.homeTeamData
      ? (this.homeTeamData.prefix && this.homeTeamData.prefix[0] ? this.homeTeamData.prefix[0] + " " : "") + this.homeTeamData.name
      : "Hogwarts Hawks";
    const awayTeamNominative = this.awayTeamData
      ? (this.awayTeamData.prefix && this.awayTeamData.prefix[0] ? this.awayTeamData.prefix[0] + " " : "") + this.awayTeamData.name
      : "Durmstrang Dragons";

    // Schlusssatz erstellen (verwende den Akkusativ):
    if (winningTeam === 'home') {
      if (this.finalSnitchCatcherTeam === 'home') {
        summary = `${this.finalSnitchCatcherName} fängt den Schnatz und sichert ${homeTeamAccusative} so den Sieg.`;
      } else {
        summary = `Der Schnatzfang von ${this.finalSnitchCatcherName} reichte nicht aus, ${homeTeamAccusative} vor der Niederlage zu bewahren.`;
      }
    } else if (winningTeam === 'away') {
      if (this.finalSnitchCatcherTeam === 'away') {
        summary = `${this.finalSnitchCatcherName} fängt den Schnatz und sichert ${awayTeamAccusative} so den Sieg.`;
      } else {
        summary = `Der Schnatzfang von ${this.finalSnitchCatcherName} reichte nicht aus, ${awayTeamAccusative} vor der Niederlage zu bewahren.`;
      }
    } else { // draw
      if (this.finalSnitchCatcherTeam === 'home') {
        summary = `Der Schnatzfang von ${this.finalSnitchCatcherName} sichert ${homeTeamAccusative} zumindest noch das Remis.`;
      } else {
        summary = `Der Schnatzfang von ${this.finalSnitchCatcherName} sichert ${awayTeamAccusative} zumindest noch das Remis.`;
      }
    }

    // MVP ermitteln:
    let mvp: Player | null = null;
    if (winningTeam === 'home') {
      mvp = this.homePlayers.reduce((best, p) =>
        (!best || p.todayPerformance > best.todayPerformance) ? p : best, null as Player | null);
      if (mvp) {
        mvpMessage = mvp.gender === 'female'
          ? `Herausragende Spielerin war ${mvp.name}, die ${homeTeamNominative} zum Sieg führte.`
          : `Herausragender Spieler war ${mvp.name}, der ${homeTeamNominative} zum Sieg führte.`;
      }
    } else if (winningTeam === 'away') {
      mvp = this.awayPlayers.reduce((best, p) =>
        (!best || p.todayPerformance > best.todayPerformance) ? p : best, null as Player | null);
      if (mvp) {
        mvpMessage = mvp.gender === 'female'
          ? `Herausragende Spielerin war ${mvp.name}, die ${awayTeamNominative} zum Sieg führte.`
          : `Herausragender Spieler war ${mvp.name}, der ${awayTeamNominative} zum Sieg führte.`;
      }
    } else {
      const allPlayers = [...this.homePlayers, ...this.awayPlayers];
      mvp = allPlayers.reduce((best, p) =>
        (!best || p.todayPerformance > best.todayPerformance) ? p : best, null as Player | null);
      if (mvp) {
        mvpMessage = mvp.gender === 'female'
          ? `${mvp.name} war die beste Spielerin auf dem Quidditchfeld.`
          : `${mvp.name} war der beste Spieler auf dem Quidditchfeld.`;
      }
    }

    this.summaryLog = summary + "\n" + mvpMessage;
  }








  // Haupt-Game-Loop, der in jedem Intervall aufgerufen wird.
  // Wird nicht ausgeführt, solange eine Eventkette angezeigt wird.
  private mainGameLoop(): void {
    if (this.isEventChainActive) {
      // Während eine Eventkette angezeigt wird, wird die Zeit angehalten.
      return;
    }
    // Schnatz-Event hat Vorrang: Zuerst prüfen!
    if (this.processSnitchEvent()) {
      // Wenn ein Schnatz-Event ausgelöst wurde, wird im Callback der Timer gestoppt.
      return;
    }
    this.currentMinute++;
    this.processChaserShot();
    this.processTimePenalty();
    this.updateTeamScore();

  }



  // Hilfsmethode: Berechnet den addierten Skillwert aller Jäger eines Teams
  private getTotalJagerSkill(players: Player[]): number {
    return players
      .filter((p) => p.position === 'Jäger')
      .reduce((teamSum, player) => {
        const playerSum = Object.values(player.skills).reduce((sum, value) => sum + value, 0);
        return teamSum + playerSum;
      }, 0);
  }

  // Zeigt die einzelnen Segmente einer Eventkette nacheinander an.
  // Jedes Segment wird für 3 Sekunden angezeigt, und am Ende wird der Callback ausgeführt.
  private displayEventChain(chain: string[], callback: () => void): void {
    this.isEventChainActive = true;
    let index = 0;
    const displayNext = () => {
      if (index < chain.length) {
        this.currentEventSegment = chain[index];
        index++;
        setTimeout(displayNext, this.textTempo);
      } else {
        this.currentEventSegment = "";
        this.isEventChainActive = false;
        callback();
      }
    };
    displayNext();
  }

  // Aktualisiert den Gesamtscore basierend auf den Einzelwerten.
  private updateScore(): void {
    this.updateTeamScore();
  }

  private updatePerformance(player: Player, delta: number): void {
    player.todayPerformance = Math.min(10, player.todayPerformance + delta);
  }



  private getRandomTemplate(
    category: keyof EventTemplates,
    type: string,
    placeholders: { [key: string]: string },
    additionalPlaceholders?: { [key: string]: string }
  ): string {
    const catTemplates = (eventTemplates as EventTemplates)[category];
    const templates = catTemplates[type as keyof typeof catTemplates] as string[] | undefined;
    if (!templates || templates.length === 0) {
      console.warn(`Keine Templates gefunden für ${category} - ${type}`);
      return "";
    }
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    if (!randomTemplate) return "";
    
    let output = randomTemplate;
    // Fasse beide Placeholder-Objekte zusammen
    const combinedPlaceholders = { ...placeholders, ...additionalPlaceholders };
    for (const key in combinedPlaceholders) {
      output = output.replace(new RegExp(`{${key}}`, 'g'), combinedPlaceholders[key]);
    }
    return output;
  }
  
  


}
