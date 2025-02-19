import { Injectable } from '@angular/core';
import { Firestore, collection, setDoc, doc } from '@angular/fire/firestore';
import teamsData from '../assets/json/teams.json';

interface Team {
  name: string;
  prefix: string[]; // Jetzt ein Array, z. B. ["die", "den"]
  players: any[]; // Hier könntest du auch ein spezifisches Player-Interface nutzen
}

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  constructor(private firestore: Firestore) {}

  async uploadTeams() {
    const teamsCollection = collection(this.firestore, 'teams');
    for (const team of teamsData) {
      // Sicherstellen, dass team.prefix ein Array ist:
      const prefixArray: string[] = Array.isArray(team.prefix) ? team.prefix : [team.prefix || ""];

      // Transformiere das JSON-Objekt in das gewünschte Team-Format:
      const teamObj: Team = {
        name: team.teamName, // "teamName" im JSON wird zu "name"
        prefix: prefixArray,
        players: team.players // Enthält jetzt auch "gender" etc.
      };
      const teamDoc = doc(teamsCollection, team.teamName);
      await setDoc(teamDoc, teamObj);
    }
  }
}
