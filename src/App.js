import useSWR from 'swr';
import { Routes, Route, BrowserRouter, useParams } from 'react-router-dom';
import { useState } from "react";

// created function to handle API request
const fetcher = (...args) => fetch(...args).then((res) => res.json());

const API_BASE_URL = 'http://localhost:8000';

function Header() {
  return (
    <div className="hstack gap-3">
      <a href="/">
        <img
          src="https://netstorage.ringcentral.com/appext/logo/kNku72HNQPWCo-uLCKS4Hw~wCZbXGy1Qu-z3dzQ3U_j7Q/b8e47126-bf75-41df-bbf0-844db0a925a4.png"
          height="40"/>
      </a>
    </div>
  );
}

function QuestionList() {
  const {
    data: questions,
    error,
    isValidating,
  } = useSWR(`${API_BASE_URL}/api/questions/`, fetcher);

  // Handles error and loading state
  if (error) {
    return <div className='failed'>failed to load</div>;
  }
  if (isValidating) {
    return <div className="Loading">Loading...</div>;
  }

  return (
    <div>
      <ul>
        {questions.map((question) => (
          <li key={question.id}>
            <a href={`/question/${question.id}`}>{question.question_text}</a>
          </li>
        ))}
      </ul>
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
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice: selectedChoiceId }),
    };
    try {
      question = await fetcher(`${API_BASE_URL}/api/questions/${question.id}/vote`, requestOptions);
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<MainPage/>}></Route>
        <Route path='/question/:questionId' element={<QuestionDetailPage/>}></Route>
      </Routes>
    </BrowserRouter>
  );
}
