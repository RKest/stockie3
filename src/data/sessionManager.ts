interface ISession {
    id: string;
    sessionData: number[];
    batchSize: number;
    currentBatch: number;
}

export default class SessionManager {
    private _sessions: ISession[] = [];
    private _leftoverData: number[] = [];

    createSession(batchSize: number){
        const id = getRandomString(10);
        this._sessions.push({
            id: id,
            sessionData: [],
            batchSize: batchSize,
            currentBatch: 0
        });
        return id;
    }

    progressSession(id: string, byHowMutch: number, data: number[]){
        const sessionIndex = this.getSessiomIndex(id);
        this._sessions[sessionIndex].currentBatch += byHowMutch;
        if(this._sessions[sessionIndex].batchSize < this._sessions[sessionIndex].currentBatch)
            this.loadLeftoerData(data, sessionIndex), this.destroySession(id);
    }

    getSession(id: string){
        const sessionIndex = this.getSessiomIndex(id);
        return this._sessions[sessionIndex];
    }

    get leftoverData(){
        return this._leftoverData;
    }
    
    private loadLeftoerData(data: number[], sessionIndex: number){
        const batchSize = this._sessions[sessionIndex].batchSize, currentBatch = this._sessions[sessionIndex].currentBatch;
        const startIndex = currentBatch - batchSize;
        this._leftoverData = data.slice(startIndex);
    }

    private getSessiomIndex(id: string): number {
        const sessionIndex = this._sessions.findIndex(sess => sess.id === id);

        if(sessionIndex === -1)
            throw new Error(`No session found with id ${id}`);
        
        return sessionIndex;
    }

    private destroySession(id: string) {
        const sessionIndex = this.getSessiomIndex(id);
        this._sessions.splice(sessionIndex, 1);
    }
}

function getRandomString(len: number): string{
    const sampleString = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM';
    const randomIndex = (): number => Math.floor(Math.random() * len);
    let returnString = '';
    for(var i = 0; i < len; i++)
        returnString += sampleString[randomIndex()];
    return returnString;
}