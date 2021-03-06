// @flow

import { type StoreEnhancer, compose, createStore } from 'redux'
import { type ReduxProps, attachPixie, filterPixie } from 'redux-pixies'
import { emit } from 'yaob'

import {
  type EdgeContext,
  type EdgeContextOptions,
  type EdgeIo
} from '../types/types.js'
import { type RootAction } from './actions.js'
import { type RootProps, rootPixie } from './root-pixie.js'
import { type RootState, reducer } from './root-reducer.js'

let allContexts: Array<EdgeContext> = []

const composeEnhancers =
  typeof window === 'object' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({ name: 'core' })
    : compose

function nop () {}

/**
 * Creates the root object for the entire core state machine.
 * This core object contains the `io` object, context options,
 * Redux store, and tree of background workers.
 */
export async function makeContext (
  io: EdgeIo,
  opts: EdgeContextOptions
): Promise<EdgeContext> {
  const onErrorDefault = (error, name) => io.console.error(name, error)

  const {
    apiKey,
    appId = '',
    authServer = 'https://auth.airbitz.co/api',
    callbacks = {},
    changellyInit = void 0,
    faastInit = void 0,
    hideKeys = false,
    plugins = [],
    shapeshiftKey = void 0,
    changeNowKey = void 0
  } = opts
  const { onError = onErrorDefault, onExchangeUpdate = nop } = callbacks

  if (apiKey == null) {
    throw new Error('No API key provided')
  }

  // Start Redux:
  const enhancers: StoreEnhancer<RootState, RootAction> = composeEnhancers()
  const redux = createStore(reducer, enhancers)
  redux.dispatch({
    type: 'INIT',
    payload: { apiKey, appId, authServer, hideKeys }
  })

  // Load the login stashes from disk:
  const stashes = {}
  const listing = await io.disklet.list('logins')
  const files = Object.keys(listing).filter(path => listing[path] === 'file')
  for (const path of files) {
    try {
      stashes[path] = JSON.parse(await io.disklet.getText(path))
    } catch (e) {}
  }
  redux.dispatch({
    type: 'LOGIN_STASHES_LOADED',
    payload: stashes
  })

  // Start the pixie tree:
  const mirror = { output: {} }
  const closePixie = attachPixie(
    redux,
    filterPixie(
      rootPixie,
      (props: ReduxProps<RootState, RootAction>): RootProps => ({
        ...props,
        close () {
          closePixie()
          redux.dispatch({ type: 'CLOSE' })
        },
        io,
        onError: error => {
          onError(error)
          if (mirror.output.context && mirror.output.context.api) {
            emit(mirror.output.context.api, 'error', error)
          }
        },
        onExchangeUpdate,
        plugins,
        changellyInit,
        changeNowKey,
        faastInit,
        shapeshiftKey
      })
    ),
    e => console.error(e),
    output => (mirror.output = output)
  )

  const out = mirror.output.context.api
  allContexts.push(out)
  return out
}

/**
 * We use this for unit testing, to kill all core contexts.
 */
export function destroyAllContexts () {
  for (const context of allContexts) context.close()
  allContexts = []
}
