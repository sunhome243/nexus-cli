/**
 * FileHandler - Provider별 파일 처리 추상화
 * Gemini: 같은 파일 백업 방식, Claude: 다른 파일 추적 방식
 */

import { UniversalMessage } from '../types.js';

export abstract class FileHandler {
  /**
   * 비교를 위한 이전 상태 파일 경로 반환
   */
  abstract getBeforeFile(sessionTag: string): Promise<string>;

  /**
   * 현재 상태 파일 경로 반환
   */
  abstract getAfterFile(sessionTag: string): Promise<string>;

  /**
   * 파일에서 conversation 읽기
   */
  abstract readConversation(filePath: string): Promise<UniversalMessage[]>;

  /**
   * 파일에 conversation 쓰기
   */
  abstract writeConversation(filePath: string, messages: UniversalMessage[]): Promise<void>;

  /**
   * Sync 완료 후 상태 업데이트
   */
  abstract updateAfterSync(sessionTag: string): Promise<void>;

  /**
   * 파일이 존재하는지 확인
   */
  abstract fileExists(filePath: string): Promise<boolean>;

  /**
   * 초기 상태 설정 (최초 sync 전)
   */
  abstract initializeState(sessionTag: string): Promise<void>;
}