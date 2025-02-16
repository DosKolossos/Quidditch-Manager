import { Injectable } from '@angular/core';
import { Firestore, collection, setDoc, doc } from '@angular/fire/firestore';
import teamsData from '../assets/json/teams.json';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  constructor(private firestore: Firestore) {}

  async uploadTeams() {
    const teamsCollection = collection(this.firestore, 'teams');
    for (const team of teamsData) {
      const teamDoc = doc(teamsCollection, team.teamName);
      await setDoc(teamDoc, team);
    }
    console.log('Teams erfolgreich in Firestore hochgeladen!');
  }
}
