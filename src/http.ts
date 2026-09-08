/** ******************************************************************************
 *  (c) 2018 - 2024 Zondax AG
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */
import axios from 'axios'
import axiosRetry from 'axios-retry'

/**
 * Dedicated axios instance for talking to the Speculos API.
 *
 * Retries are configured once here. Registering the retry interceptors on the
 * global axios instance on every request leaked interceptors and altered the
 * behaviour of consumers' own axios usage.
 */
export const http = axios.create()

axiosRetry(http, { retries: 3, retryDelay: axiosRetry.exponentialDelay })
