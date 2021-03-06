import React from 'react';
import './RecentGames.css';
import { withFirebase } from '../Firebase';
import Loading from '../Loading';
import GameSummary from './GameSummary';

const MAX_NUMBER_OF_RECENT_GAMES = 20;
const MAX_AGE_OF_RECENT_GAMES_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

class RecentGames extends React.Component {
  constructor(props) {
    super(props);

    this.state = { 
      recentGames: [],
      loading: false,
      error: null,
      serverTimeOffsetMs: null,
      estimatedServerTimeMs: null,
    };
  }

  componentDidMount() {
    this._isMounted = true;
    this._timer = null;

    if (process.env.NODE_ENV !== 'production') console.log('this.props.user = ' + this.props.user);
      
    if (this.props.user && this.props.user.authUser && this.props.user.authUser.uid) {
      this.dbLoadRecentGames(this.props.user.authUser.uid);
    }

    // 1 second timer to refresh game times
    this._timer = setInterval(() => {
      if (this._isMounted && this.state.serverTimeOffsetMs !== null) {
        this.setState({
          estimatedServerTimeMs: new Date().getTime() + this.state.serverTimeOffsetMs,
        })
      }
    }, 1000);

  }

  componentWillUnmount() {
    this._isMounted = false;

    if (this.props.user && this.props.user.authUser && this.props.user.authUser.uid) {
      this.dbStopListening(this.props.user.authUser.uid);
    }
    
    clearInterval(this._timer);
  }

  dbStopListening(userId) {
    this.props.firebase.games().orderByChild("players/" + userId + "/activeTime").off();
  }

  dbLoadRecentGames(userId) {
    this.setState({ loading: true });

    this.props.firebase.games().orderByChild("players/" + userId + "/activeTime").limitToLast(MAX_NUMBER_OF_RECENT_GAMES)
    .on('value', snapshot => {
      let error = null;
      if (snapshot.val()) {
        if (process.env.NODE_ENV !== 'production') console.log('Firebase DB: Successfully loaded recent games for user ' + userId);
      }
      else {
        error = 'Failed to load recent games for user ' + userId + '.';
        console.error('Firebase DB: Failed to load recent games for user ' + userId);
      }

      this.props.firebase.serverTimeOffset()
      .once("value", snapshotOffset => {
        let offset = snapshotOffset.val();
        let serverTime = new Date().getTime() + offset;
        if (process.env.NODE_ENV !== 'production') console.log('Firebase DB: Server offset is ' + offset + ' ms');
        if (process.env.NODE_ENV !== 'production') console.log('Firebase DB: Est server time is ' + serverTime + ' ms');
        
        const games = [];
        if (snapshot.numChildren() > 0) {
          snapshot.forEach( gameSnapshot => {
            if (gameSnapshot.val().players && gameSnapshot.val().players[userId]
                && serverTime - gameSnapshot.val().players[userId].activeTime < MAX_AGE_OF_RECENT_GAMES_MS ) {
              games.push({
                gameId: gameSnapshot.key,
                host: gameSnapshot.val().host,
                gameInProgress: gameSnapshot.val().gameInProgress,
                gameHasEnded: gameSnapshot.val().gameHasEnded,
                players: gameSnapshot.val().players,
                lastTurnTime: gameSnapshot.val().lastTurnTime,
                playerSequence: gameSnapshot.val().playerSequence,
                currentPlayer: gameSnapshot.val().currentPlayer,
              });
            }  
          });
        } 
        else {
          if (process.env.NODE_ENV !== 'production') console.log('No recent games found for user ' + userId);
        }
        
        if (this._isMounted) {
          this.setState({
            recentGames: games.reverse(),
            error: error,
            serverTimeOffsetMs: offset,
            estimatedServerTimeMs: serverTime,
            loading: false,
          })
        }
      });
    });
    /*.then(
      
    );*/
  }

  render() {
    let games = [];
    if (this.state.recentGames && this.state.recentGames.length > 0) {
      games = this.state.recentGames.map(a => ( 
        <GameSummary 
          key = {a.gameId}
          gameId = {a.gameId}
          uid = {this.props.user.authUser.uid}
          host = {a.host}
          players = {a.players}
          currentPlayer = {a.playerSequence && a.playerSequence[a.currentPlayer]}
          gameInProgress = {a.gameInProgress}
          gameHasEnded = {a.gameHasEnded}
          gameAge = {this.state.estimatedServerTimeMs - a.lastTurnTime}
        /> 
      ));
    }

    return (
      <div>
        {games.length > 0 && <h3>Recent games</h3>}
        {games.length > 0 && <div className="recentgames">{games}</div>}
        {/*!this.state.loading && games.length === 0 && <p>No recent games found</p>*/}
        {this.state.loading && <Loading className="inline-small"/>}
        {this.state.error && <p className="error">{this.state.error}</p>}
      </div>
    );
  }
}

export default withFirebase(RecentGames);
