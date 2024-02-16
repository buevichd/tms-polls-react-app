import useSWR from 'swr';
import { Routes, Route, BrowserRouter, useParams, useNavigate } from 'react-router-dom';
import { useState } from "react";
import { axiosInstance, API_BASE_URL } from "./apiConfig.js";
import { AuthProvider, useAuth } from "./authProvider";


function handleApiResponse(response) {
  if (response.status >= 200 && response.status < 300) {
    return response.data;
  }
  throw Error(`API returns status code ${response.status} (${response.statusText})`);
}

// function to handle API request
function fetcher(...args) {
  return axiosInstance.get(...args).then(handleApiResponse);
}

const LoginButton = () => {
  return (
    <li className="nav-item active">
      <a className="btn btn-outline-info my-2 my-sm-0" href="/login">Login</a>
    </li>
  );
}

const LogoutButton = () => {
  const { setToken, setRefreshToken } = useAuth();

  function onLogout() {
    setToken();
    setRefreshToken();
  }

  return (
    <li className="nav-item active">
      <button className="btn btn-outline-danger my-2 my-sm-0" onClick={onLogout}>Logout</button>
    </li>
  );
}

function Header() {
  const { token } = useAuth();
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <a className="navbar-brand" href="/">
        <img
          src="https://netstorage.ringcentral.com/appext/logo/kNku72HNQPWCo-uLCKS4Hw~wCZbXGy1Qu-z3dzQ3U_j7Q/b8e47126-bf75-41df-bbf0-844db0a925a4.png"
          alt='logo' height="40"/>
      </a>
      <ul className="navbar-nav mr-auto">
        {token ? <LogoutButton/> : <LoginButton/>}
      </ul>
    </nav>
  );
}

function PageButton({ page, setPage, text }) {
  return (
    <li className="page-item" onClick={() => setPage(page)}>
      <a className="page-link" href="#">
        {text || page}
      </a>
    </li>
  );
}

function Pagination({ page, maxPage, setPage }) {
  return (
    <nav>
      <ul className="pagination">
        {page > 1 &&
          <>
            <PageButton page={1} setPage={setPage} text="&laquo;"/>
            <PageButton page={page - 1} setPage={setPage}/>
          </>
        }
        <PageButton page={page} setPage={setPage}/>
        {page < maxPage &&
          <>
            <PageButton page={page + 1} setPage={setPage}/>
            <PageButton page={maxPage} setPage={setPage} text="&raquo;"/>
          </>
        }
      </ul>
    </nav>
  );
}

function QuestionList() {
  const pageSize = 5;
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState('-pub_date')

  const {
    data,
    error,
    isValidating,
  } = useSWR(`${API_BASE_URL}/api/questions/?page_size=${pageSize}&page=${page}&ordering=${ordering}`, fetcher);

  // Handles error and loading state
  if (error) {
    console.log(`Failed to load questions. ${error}`);
    return <div className='failed'>Failed to load...</div>;
  }
  if (isValidating) {
    return <div className="Loading">Loading...</div>;
  }

  let questions = data;
  let maxPage = null;
  const pagingIsSupported = data.hasOwnProperty('results');
  if (pagingIsSupported) {
    questions = data.results;
    maxPage = Math.floor((data.count - 1) / pageSize) + 1;
  }

  return (
    <div>
      <select value={ordering} onChange={e => setOrdering(e.target.value)}
              className="form-select form-select-lg mb-3">
        <option value="pub_date">Pub date (ascending)</option>
        <option value="-pub_date">Pub date (descending)</option>
        <option value="question_text">Question Text (ascending)</option>
        <option value="-question_text">Question Text (descending)</option>
      </select>
      <ul>
        {questions.map((question) => (
          <li key={question.id}>
            <a href={`/question/${question.id}`}>{question.question_text}</a>
          </li>
        ))}
      </ul>
      {pagingIsSupported && <Pagination page={page} setPage={setPage} maxPage={maxPage}/>}
    </div>
  );
}

function MainPage() {
  return (
    <div>
      <Header/>
      <QuestionList/>
    </div>
  );
}

function ChoiceList({ question, hasVoted, onUpdateVote }) {
  const [selectedChoiceId, setSelectedChoiceId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  if (!question.choices) {
    return <p className="text-danger">Question JSON does not have choices.</p>
  }

  if (hasVoted) {
    function onReVote() {
      setSelectedChoiceId(null);
      setSuccessMessage(null);
      onUpdateVote(question, false);
    }

    return (
      <>
        {successMessage && <p className="text-success">{successMessage}</p>}
        <ul>
          {question.choices.map(choice => (
            <li key={choice.id}>{choice.choice_text} - {choice.votes} votes</li>
          ))}
        </ul>
        <button className="btn btn-info" onClick={onReVote}>
          Revote
        </button>
      </>
    );
  }

  async function handleVote(e) {
    e.preventDefault();
    if (!selectedChoiceId) {
      setErrorMessage('Please select a choice.');
      return;
    }


    const headers = { 'Content-Type': 'application/json' };
    const body = { choice: selectedChoiceId };
    try {
      question = await axiosInstance
        .post(`${API_BASE_URL}/api/questions/${question.id}/vote`, body, { headers })
        .then(handleApiResponse);
    } catch (e) {
      console.log(e);
      setErrorMessage('Vote is not supported by API :(');
      return;
    }
    setSuccessMessage('You successfully voted!');
    onUpdateVote(question, true);
  }

  function handleChangeSelectedChoice(e) {
    setSelectedChoiceId(e.target.value);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  return (
    <form onSubmit={handleVote}>
      {errorMessage && <p className="text-danger">{errorMessage}</p>}
      {question.choices.map(choice => (
        <div key={choice.id}>
          <input type="radio" name="choice" id={'choice-' + choice.id}
                 value={choice.id} onChange={handleChangeSelectedChoice}/>
          <label htmlFor={'choice-' + choice.id}>
            &nbsp;{choice.choice_text}
          </label>
          <br/>
        </div>
      ))}
      <button type="submit" className="btn btn-info">Vote</button>
    </form>
  );
}

function QuestionDetailPage() {
  const { questionId } = useParams();
  const [hasVoted, setHasVoted] = useState(false);
  const [question, setQuestion] = useState(null);

  const {
    data,
    error,
    isValidating,
  } = useSWR(`${API_BASE_URL}/api/questions/${questionId}`, fetcher);

  // Handles error and loading state
  if (error) {
    return <div className='failed'>failed to load</div>;
  }
  if (isValidating) {
    return <div className="Loading">Loading...</div>;
  }
  if (!question) {
    setQuestion(data);
    return <div className="Loading">Loading...</div>;
  }

  function onUpdateVote(newQuestion, newHasVote) {
    setQuestion(newQuestion);
    setHasVoted(newHasVote);
  }

  return (
    <div>
      <Header/>
      <h1>{question.question_text}</h1>
      <ChoiceList question={question} hasVoted={hasVoted}
                  onUpdateVote={onUpdateVote}/>
    </div>
  );
}

const Login = () => {
  const { setToken, setRefreshToken } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState();

  async function handleLogin(e) {
    e.preventDefault();
    try {
      const response = await axiosInstance
        .post(`${API_BASE_URL}/api/token/`, { username, password })
        .catch((error) => {
          if (error.response.status === 400 || error.response.status === 401) {
            setErrorMessage('Invalid login and/or password');
            return error.response;
          }
          throw error;
        });
      if (response.data && response.data.access && response.data.refresh) {
        setToken(response.data.access);
        setRefreshToken(response.data.refresh);
        navigate("/", { replace: true });
      }
    } catch (e) {
      console.log(e);
      setErrorMessage('Obtain token is not supported by API :(');
    }
  }

  return <>
    <Header/>
    {errorMessage && <div className="alert alert-danger" role="alert">{errorMessage}</div>}
    <form onSubmit={handleLogin}>
      <div className="form-group">
        <label htmlFor="inputLogin">Login</label>
        <input type="text" className="form-control" id="inputLogin"
               placeholder="Login" onChange={(e) => setUsername(e.target.value)}/>
      </div>
      <div className="form-group">
        <label htmlFor="inputPassword">Password</label>
        <input type="password" className="form-control" id="inputPassword"
               placeholder="Password" onChange={(e) => setPassword(e.target.value)}/>
      </div>
      <button type="submit" className="btn btn-primary">Submit</button>
    </form>
  </>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<MainPage/>}/>
          <Route path='/question/:questionId' element={<QuestionDetailPage/>}/>
          <Route path='/login' element={<Login/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
